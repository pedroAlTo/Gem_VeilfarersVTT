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

export async function compressImageForUpload(file, maxBytes = 9.5 * 1024 * 1024) {
  if (!file || typeof window === 'undefined' || typeof document === 'undefined') return file;
  if (file.size <= maxBytes) return file;

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      const MAX_DIM = 4096;
      if (width > MAX_DIM || height > MAX_DIM) {
        if (width >= height) {
          height = Math.round((height * MAX_DIM) / width);
          width = MAX_DIM;
        } else {
          width = Math.round((width * MAX_DIM) / height);
          height = MAX_DIM;
        }
      }

      const getBlob = (w, h, q) => new Promise(res => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          canvas.toBlob(b => res(b), 'image/webp', q);
        } catch { res(null); }
      });

      (async () => {
        let curW = width, curH = height, q = 0.86;
        let blob = await getBlob(curW, curH, q);

        while (blob && blob.size > maxBytes && q > 0.45) {
          q -= 0.12;
          blob = await getBlob(curW, curH, q);
        }

        while (blob && blob.size > maxBytes && curW > 1200) {
          curW = Math.round(curW * 0.78);
          curH = Math.round(curH * 0.78);
          blob = await getBlob(curW, curH, Math.max(0.45, q));
        }

        if (blob && blob.size <= maxBytes) {
          const cleanName = (file.name || 'map').replace(/\.[^/.]+$/, '') + '.webp';
          resolve(new File([blob], cleanName, { type: 'image/webp' }));
        } else if (blob) {
          // If still over, final lower quality attempt
          const finalBlob = await getBlob(Math.round(curW * 0.7), Math.round(curH * 0.7), 0.4);
          if (finalBlob) {
            const cleanName = (file.name || 'map').replace(/\.[^/.]+$/, '') + '.webp';
            resolve(new File([finalBlob], cleanName, { type: 'image/webp' }));
            return;
          }
          resolve(file);
        } else {
          resolve(file);
        }
      })().catch(() => resolve(file));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });
}

export async function uploadToCloudinary(file, onProgress = () => {}, options = {}) {
  const { cloudName, preset, isConfigured } = getCloudinaryConfig();
  if (!isConfigured) {
    throw new Error('Cloudinary no está configurado (falta Cloud Name o Upload Preset).');
  }

  const prefix = options.prefix || '';
  let uploadFile = file;
  if (file && file.size > 9.5 * 1024 * 1024) {
    onProgress(1);
    uploadFile = await compressImageForUpload(file);
  }
  if (prefix && uploadFile && typeof File !== 'undefined' && uploadFile instanceof File) {
    const rawName = (uploadFile.name || 'asset').replace(/\.[^/.]+$/, '');
    const ext = (uploadFile.name || '').split('.').pop() || 'png';
    const cleanPrefixed = rawName.startsWith(prefix) ? rawName : `${prefix}${rawName}`;
    uploadFile = new File([uploadFile], `${cleanPrefixed}.${ext}`, { type: uploadFile.type });
  }

  const formData = new FormData();
  formData.append('file', uploadFile);
  formData.append('upload_preset', preset);
  if (options.folder) {
    formData.append('folder', options.folder);
  }

  return new Promise((resolve, reject) => {
    if (typeof XMLHttpRequest === 'undefined') {
      // Node / test environment fallback
      const pubId = (prefix || '') + 'test_asset';
      resolve({
        url: 'https://res.cloudinary.com/' + encodeURIComponent(cloudName) + '/image/upload/f_auto,q_auto/' + pubId + '.webp',
        rawUrl: 'https://res.cloudinary.com/' + encodeURIComponent(cloudName) + '/image/upload/' + pubId + '.jpg',
        width: 1920,
        height: 1080,
        bytes: file.size || 1024,
        publicId: pubId
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

