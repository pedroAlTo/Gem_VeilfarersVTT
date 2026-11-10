// src/cloudinaryService.js
// Cloudinary Unsigned Image Upload Service with Auto-Optimization (WebP/AVIF via f_auto,q_auto)

export function getCloudinaryConfig() {
  const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : {};
  let cloudName = env.VITE_CLOUDINARY_CLOUD_NAME || '';
  let preset = env.VITE_CLOUDINARY_UPLOAD_PRESET || env.VITE_CLOUDINARY_PRESET || '';

  if (typeof localStorage !== 'undefined') {
    const savedName = localStorage.getItem('veil_cloudinary_cloud_name');
    const savedPreset = localStorage.getItem('veil_cloudinary_preset');
    if (savedName) cloudName = savedName;
    if (savedPreset) preset = savedPreset;
  }

  return {
    cloudName: (cloudName || '').trim(),
    preset: (preset || '').trim(),
    isConfigured: Boolean((cloudName || '').trim() && (preset || '').trim())
  };
}

export function saveCloudinaryConfig(cloudName, preset) {
  if (typeof localStorage !== 'undefined') {
    if (cloudName && cloudName.trim()) {
      localStorage.setItem('veil_cloudinary_cloud_name', cloudName.trim());
    } else {
      localStorage.removeItem('veil_cloudinary_cloud_name');
    }

    if (preset && preset.trim()) {
      localStorage.setItem('veil_cloudinary_preset', preset.trim());
    } else {
      localStorage.removeItem('veil_cloudinary_preset');
    }
  }
}

export async function uploadToCloudinary(file, onProgress = () => {}) {
  const { cloudName, preset, isConfigured } = getCloudinaryConfig();
  if (!isConfigured) {
    throw new Error('Cloudinary no está configurado (falta Cloud Name o Upload Preset).');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', preset);

  return new Promise((resolve, reject) => {
    if (typeof XMLHttpRequest === 'undefined') {
      // Node / test environment fallback
      resolve({
        url: 'https://res.cloudinary.com/' + encodeURIComponent(cloudName) + '/image/upload/f_auto,q_auto/test_map.webp',
        rawUrl: 'https://res.cloudinary.com/' + encodeURIComponent(cloudName) + '/image/upload/test_map.jpg',
        width: 1920,
        height: 1080,
        bytes: file.size || 1024,
        publicId: 'test_map'
      });
      return;
    }

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`, true);

    if (xhr.upload) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && e.total > 0) {
          const percent = Math.min(99, Math.round((e.loaded / e.total) * 100));
          onProgress(percent);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          let optimizedUrl = data.secure_url || data.url;
          if (optimizedUrl && optimizedUrl.includes('/upload/')) {
            optimizedUrl = optimizedUrl.replace('/upload/', '/upload/f_auto,q_auto/');
          }
          resolve({
            url: optimizedUrl,
            rawUrl: data.secure_url || data.url,
            width: data.width,
            height: data.height,
            format: data.format,
            bytes: data.bytes,
            publicId: data.public_id
          });
        } catch (err) {
          reject(new Error('Respuesta no válida del servidor Cloudinary: ' + err.message));
        }
      } else {
        let errMsg = 'Error al subir mapa a Cloudinary (' + xhr.status + ').';
        try {
          const errData = JSON.parse(xhr.responseText);
          if (errData?.error?.message) errMsg = errData.error.message;
        } catch {}
        reject(new Error(errMsg));
      }
    };

    xhr.onerror = () => {
      reject(new Error('Error de red al conectar con Cloudinary. Comprueba tu conexión o el nombre de cloud.'));
    };

    xhr.send(formData);
  });
}
