import { Reveal } from '../hooks/motion'
import { waLink } from '../utils/format'

const PLANS = [
  {
    icon: '🟢',
    name: 'Plan Base — Chat Local',
    target: 'Para empezar a correr modelos en tu PC',
    features: [
      'Ollama + LM Studio instalados y optimizados',
      'Descarga y configuración de modelos 7B/8B (Llama, Mistral, Qwen)',
      'API local lista para integrar tus apps',
      'Capacitación básica: prompts, contextos y gestión de modelos',
    ],
    waText:
      'Hola TechnoStore! Quiero cotizar el Plan Base de instalación IA (Ollama + LM Studio).',
  },
  {
    icon: '⚡',
    name: 'Plan Pro — Inferencia Avanzada',
    target: 'Para developers que necesitan rendimiento real',
    features: [
      'Todo lo del Plan Base',
      'CUDA / ROCm + PyTorch con entorno reproducible',
      'vLLM serviendo API compatible con OpenAI',
      'Cuantización GGUF / AWQ según tu VRAM disponible',
      'Benchmark final documentado (tokens/s por modelo)',
    ],
    waText:
      'Hola TechnoStore! Quiero cotizar el Plan Pro de instalación IA (vLLM + CUDA + cuantización).',
  },
  {
    icon: '🎨',
    name: 'Plan Studio — Imagen Generativa',
    target: 'Para creadores de contenido visual IA',
    features: [
      'Todo lo del Plan Base',
      'ComfyUI + Flux / SDXL configurados y optimizados',
      'LoRAs, ControlNet y upscalers instalados',
      'Workflows productivos importados y probados',
      'Guía de mantenimiento y actualización segura',
    ],
    waText:
      'Hola TechnoStore! Quiero cotizar el Plan Studio de instalación IA (ComfyUI + Flux/SDXL).',
  },
]

export default function ServicesSection() {
  return (
    <section id="servicios" className="container services-section">
      <span className="eyebrow">Servicio adicional</span>
      <h2>
        Instalación de <span className="grad-text">modelos locales</span> y frameworks
      </h2>
      <p className="services-sub">
        Comprás el hardware, nosotros lo dejamos produciendo. Configuración remota u
        on-site en Palermo, con garantía de configuración por 30 días.
      </p>

      <div className="services-grid">
        {PLANS.map((plan, i) => (
          <Reveal key={plan.name} delay={i * 90}>
            <article className="service-card">
              <span className="service-icon">{plan.icon}</span>
              <h3>{plan.name}</h3>
              <small>{plan.target}</small>
              <ul>
                {plan.features.map(f => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <a
                className="add-btn"
                href={waLink(plan.waText)}
                target="_blank"
                rel="noreferrer"
              >
                Cotizar por WhatsApp →
              </a>
            </article>
          </Reveal>
        ))}
      </div>

      <p className="services-note">
        💡 ¿No sabés qué plan necesita tu equipo? Escribinos: evaluamos tu hardware sin cargo.
      </p>
    </section>
  )
}
