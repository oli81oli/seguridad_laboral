const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_UPLOAD_PRESET = "ugt-incidencias";
const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

const MAX_DIMENSION = 1000;
const JPEG_QUALITY = 0.5;
const WEBP_QUALITY = 0.4;

let webpSupported;

function supportsWebP() {
  if (webpSupported !== undefined) return webpSupported;
  const canvas = document.createElement("canvas");
  webpSupported = canvas.toDataURL("image/webp").startsWith("data:image/webp");
  return webpSupported;
}

// ========================================
// COMPRESIÓN MÁXIMA DE IMÁGENES
// ========================================
function compressImage(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("El archivo no es una imagen."));
      return;
    }

    const reader = new FileReader();

    reader.onload = (event) => {
      const img = new Image();

      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height && width > MAX_DIMENSION) {
          height *= MAX_DIMENSION / width;
          width = MAX_DIMENSION;
        } else if (height > MAX_DIMENSION) {
          width *= MAX_DIMENSION / height;
          height = MAX_DIMENSION;
        }

        const canvas = document.createElement("canvas");
        canvas.width = Math.round(width);
        canvas.height = Math.round(height);

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const useWebP = supportsWebP();
        const hasTransparency = file.type === "image/png";
        let mimeType;
        let quality;
        let extension;

        if (useWebP) {
          mimeType = "image/webp";
          quality = WEBP_QUALITY;
          extension = "webp";
        } else if (hasTransparency) {
          mimeType = "image/png";
          quality = JPEG_QUALITY;
          extension = "png";
        } else {
          mimeType = "image/jpeg";
          quality = JPEG_QUALITY;
          extension = "jpg";
        }

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("No se pudo comprimir la imagen."));
              return;
            }

            resolve(
              new File(
                [blob],
                file.name.replace(/\.[^.]+$/, "." + extension),
                { type: mimeType, lastModified: Date.now() }
              )
            );
          },
          mimeType,
          quality
        );
      };

      img.onerror = () => reject(new Error("No se pudo leer la imagen."));
      img.src = event.target.result;
    };

    reader.onerror = () => reject(new Error("Error leyendo la imagen."));
    reader.readAsDataURL(file);
  });
}

// ========================================
// SUBIDA A CLOUDINARY
// ========================================
export async function uploadToCloudinary(file) {
  const compressedFile = await compressImage(file);

  const formData = new FormData();
  formData.append("file", compressedFile);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

  const response = await fetch(CLOUDINARY_UPLOAD_URL, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error("Error al subir la imagen.");
  }

  const result = await response.json();

  if (
    !result.secure_url ||
    !result.secure_url.startsWith("https://res.cloudinary.com/")
  ) {
    throw new Error("Cloudinary no devolvió una URL válida.");
  }

  return {
    ...result,
    secure_url: result.secure_url.replace(
      "/upload/",
      "/upload/f_auto,q_auto/"
    ),
  };
}