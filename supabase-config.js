/**
 * Configuración de Supabase para el Simulador CACES
 * Puedes configurar tus credenciales aquí o directamente desde la interfaz web en la pestaña "Configuración Nube".
 */
export const SupabaseConfig = {
  // Credenciales por defecto del proyecto Supabase
  DEFAULT_URL: "https://xumusduhkbpcsvuwhjuk.supabase.co",
  DEFAULT_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1bXVzZHVoa2JwY3N2dXdoanVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIyODYyNTUsImV4cCI6MjEwNzg2MjI1NX0.EiftbKlrgFyAvOttUKhzNSZhNZJEx6cF9_qiRMosZuI",

  getUrl() {
    return localStorage.getItem("caces_supabase_url") || this.DEFAULT_URL;
  },

  getAnonKey() {
    return localStorage.getItem("caces_supabase_key") || this.DEFAULT_ANON_KEY;
  },

  saveCredentials(url, key) {
    if (url) localStorage.setItem("caces_supabase_url", url.trim());
    else localStorage.removeItem("caces_supabase_url");

    if (key) localStorage.setItem("caces_supabase_key", key.trim());
    else localStorage.removeItem("caces_supabase_key");
  },

  isConfigured() {
    return Boolean(this.getUrl() && this.getAnonKey());
  },

  /**
   * Genera el script SQL para crear las tablas necesarias en Supabase con un solo clic.
   */
  getSchemaSQL() {
    return `-- Script SQL para Supabase (Ejecutar en el SQL Editor de tu proyecto en Supabase)

-- 1. Tabla de Preguntas CACES
CREATE TABLE IF NOT EXISTS public.caces_questions (
    id TEXT PRIMARY KEY,
    especialidad TEXT NOT NULL,
    subtema TEXT,
    enunciado TEXT NOT NULL,
    pregunta TEXT NOT NULL,
    opciones JSONB NOT NULL,
    correcta TEXT NOT NULL,
    justificacion TEXT,
    fuente TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS (Row Level Security) para preguntas
ALTER TABLE public.caces_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lectura pública de preguntas" ON public.caces_questions FOR SELECT USING (true);
CREATE POLICY "Inserción de preguntas autenticada o anónima" ON public.caces_questions FOR INSERT WITH CHECK (true);
CREATE POLICY "Actualización de preguntas" ON public.caces_questions FOR UPDATE USING (true);
CREATE POLICY "Eliminación libre de preguntas" ON public.caces_questions FOR DELETE USING (true);

-- 2. Tabla de Historial de Simulacros
CREATE TABLE IF NOT EXISTS public.caces_simulacros (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_email TEXT,
    device_id TEXT NOT NULL,
    modo TEXT NOT NULL,
    puntuacion_obtenida NUMERIC NOT NULL,
    total_preguntas INTEGER NOT NULL,
    porcentaje NUMERIC NOT NULL,
    tiempo_segundos INTEGER NOT NULL,
    desglose_especialidades JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.caces_simulacros ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lectura e inserción libre por device o auth" ON public.caces_simulacros FOR ALL USING (true);

-- 3. Tabla de Registro de Errores (Banco de Fallos)
CREATE TABLE IF NOT EXISTS public.caces_user_errors (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    device_id TEXT NOT NULL,
    question_id TEXT NOT NULL,
    fallos_consecutivos INTEGER DEFAULT 1,
    dominada BOOLEAN DEFAULT false,
    ultimo_fallo TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(device_id, question_id)
);

ALTER TABLE public.caces_user_errors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Manejo libre de errores por device" ON public.caces_user_errors FOR ALL USING (true);
`;
  }
};
