// Token frames (v2.60.0, the user's art: 30 HUD rings). Each frame is two images: its body, opaque,
// and its light, drawn with «screen» so black adds nothing and the glow shows over the portrait and
// the map (the user's idea). inner / outer: the hole and the outer edge, as fractions of half the
// image. color: its dominant colour, which becomes the token's colour (name, chat, subtitles).
export const TOKEN_FRAMES = [
  { id: 'frame-01', name: 'Azul neón', inner: 0.587, outer: 0.929, color: '#177bbf' },
  { id: 'frame-02', name: 'Azul técnico', inner: 0.565, outer: 0.929, color: '#1b7dbf' },
  { id: 'frame-03', name: 'Verde radar', inner: 0.582, outer: 0.929, color: '#3adc57' },
  { id: 'frame-04', name: 'Naranja blindado', inner: 0.576, outer: 0.924, color: '#cf4e03' },
  { id: 'frame-05', name: 'Ámbar de mando', inner: 0.625, outer: 0.924, color: '#d69b3d' },
  { id: 'frame-06', name: 'Azul con balizas', inner: 0.538, outer: 0.918, color: '#177bbf' },
  { id: 'frame-07', name: 'Engranaje naranja', inner: 0.489, outer: 0.94, color: '#bf2d18' },
  { id: 'frame-08', name: 'Azul táctico', inner: 0.582, outer: 0.918, color: '#1780c1' },
  { id: 'frame-09', name: 'Rojo de alerta', inner: 0.554, outer: 0.916, color: '#e05b0f' },
  { id: 'frame-10', name: 'Oro y acero', inner: 0.609, outer: 0.924, color: '#bf883f' },
  { id: 'frame-11', name: 'Azul de cabina', inner: 0.573, outer: 0.913, color: '#0e79bf' },
  { id: 'frame-12', name: 'Verde de escáner', inner: 0.5, outer: 0.913, color: '#4cdc65' },
  { id: 'frame-13', name: 'Rojo de combate', inner: 0.625, outer: 0.924, color: '#bf3343' },
  { id: 'frame-14', name: 'Ámbar de reactor', inner: 0.549, outer: 0.918, color: '#fbab1e' },
  { id: 'frame-15', name: 'Carbono', inner: 0.63, outer: 0.918, color: '#d1d1d1' },
  { id: 'frame-16', name: 'Azul con remaches', inner: 0.641, outer: 0.924, color: '#1c81bf' },
  { id: 'frame-17', name: 'Naranja de arco', inner: 0.609, outer: 0.929, color: '#bf412a' },
  { id: 'frame-18', name: 'Verde de nodos', inner: 0.641, outer: 0.929, color: '#5dea66' },
  { id: 'frame-19', name: 'Amarillo de peligro', inner: 0.663, outer: 0.929, color: '#d5971f' },
  { id: 'frame-20', name: 'Rojo lacado', inner: 0.663, outer: 0.929, color: '#cf3c38' },
  { id: 'frame-21', name: 'Octógono azul', inner: 0.674, outer: 0.929, color: '#2461bf' },
  { id: 'frame-22', name: 'Acero', inner: 0.663, outer: 0.929, color: '#d1d1d1' },
  { id: 'frame-23', name: 'Violeta', inner: 0.658, outer: 0.929, color: '#9452bf' },
  { id: 'frame-24', name: 'Cobre', inner: 0.625, outer: 0.929, color: '#bf846a' },
  { id: 'frame-25', name: 'Azul marino', inner: 0.663, outer: 0.924, color: '#7294bf' },
  { id: 'frame-26', name: 'Carbono rojo', inner: 0.636, outer: 0.918, color: '#ee2f1d' },
  { id: 'frame-27', name: 'Verde discontinuo', inner: 0.658, outer: 0.918, color: '#6dbf78' },
  { id: 'frame-28', name: 'Bronce', inner: 0.625, outer: 0.924, color: '#bf6c39' },
  { id: 'frame-29', name: 'Hielo', inner: 0.625, outer: 0.924, color: '#6f9ebf' },
  { id: 'frame-30', name: 'Grafito', inner: 0.62, outer: 0.918, color: '#d1d1d1' }
];
export const frameById = id => TOKEN_FRAMES.find(f => f.id === id) || null;
export const frameBody = frame => `/assets/tokens/frames/${frame.id}.webp`;
export const frameLight = frame => `/assets/tokens/frames/${frame.id}-light.webp`;
// For the window (v2.61.2): one image with the light already added (scripts/token-thumbs.py), so
// the window needs no CSS blend mode (tablets left those areas blank while scrolling).
export const frameThumb = frame => `/assets/tokens/frames/${frame.id}-thumb.webp`;
export const frameFlat = frame => `/assets/tokens/frames/${frame.id}-flat.webp`;
// The frame's outer edge sits at 1.2 × the token's radius; the portrait fills its hole.
export const FRAME_REACH = 1.2;
export const frameGeometry = (frame, radius) => {
  const half = (FRAME_REACH * radius) / frame.outer;
  return { half, hole: half * frame.inner };
};
