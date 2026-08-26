export interface BodyMapData {
  limitacion?: string | null;
  zonas_dolor?: string[];
  etiquetas?: string[];
  vista?: 'frente' | 'espalda' | 'ambas' | string;
  nota?: string;
}
