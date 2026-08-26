/**
 * Design Tokens — TechnoStore + Futuro Hard
 * Bold, vibrant tech startup aesthetic (Linear/Stripe/Framer inspired)
 */

export const DESIGN_TOKENS = {
  // === COLORES BASE ===
  colors: {
    // TechnoStore — naranja eléctrico + turquesa
    technostore: {
      bg: '#0A0E17',
      bgDarker: '#060A10',
      bgCard: 'rgba(255, 255, 255, 0.03)',
      bgCardHover: 'rgba(255, 255, 255, 0.06)',
      border: 'rgba(255, 255, 255, 0.08)',
      borderBright: 'rgba(255, 255, 255, 0.15)',
      text: '#F5F5F5',
      textMuted: '#8B98A5',
      textDim: '#5A6575',
      primary: '#FF6B35',    // naranja eléctrico
      secondary: '#00D4C4',  // turquesa vibrante
      gradient: 'linear-gradient(135deg, #FF6B35 0%, #00D4C4 100%)',
      gradientSoft: 'linear-gradient(135deg, rgba(255, 107, 53, 0.15), rgba(0, 212, 196, 0.15))',
      glow: 'rgba(255, 107, 53, 0.4)',
      glowSecondary: 'rgba(0, 212, 196, 0.4)',
      success: '#10B981',
      warning: '#F59E0B',
      error: '#EF4444',
    },

    // Futuro Hard — violeta + celeste eléctrico
    futurohard: {
      bg: '#0C0617',
      bgDarker: '#060310',
      bgCard: 'rgba(255, 255, 255, 0.03)',
      bgCardHover: 'rgba(255, 255, 255, 0.06)',
      border: 'rgba(255, 255, 255, 0.08)',
      borderBright: 'rgba(255, 255, 255, 0.15)',
      text: '#F5F5F5',
      textMuted: '#8B98A5',
      textDim: '#5A6575',
      primary: '#A855F7',    // violeta vibrante
      secondary: '#06B6D4',  // celeste eléctrico
      gradient: 'linear-gradient(135deg, #A855F7 0%, #06B6D4 100%)',
      gradientSoft: 'linear-gradient(135deg, rgba(168, 85, 247, 0.15), rgba(6, 182, 212, 0.15))',
      glow: 'rgba(168, 85, 247, 0.4)',
      glowSecondary: 'rgba(6, 182, 212, 0.4)',
      success: '#10B981',
      warning: '#F59E0B',
      error: '#EF4444',
    },

    // Admin — neutro técnico
    admin: {
      bg: '#0B0D10',
      bgCard: '#111318',
      border: 'rgba(255,255,255,0.08)',
      text: '#E8EAF0',
      textMuted: '#8B93A7',
      primary: '#06B6D4',
      gradient: 'linear-gradient(135deg, #06B6D4 0%, #A855F7 100%)',
    },
  },

  // === TIPOGRAFÍA ===
  typography: {
    fontDisplay: '"Space Grotesk", "Inter", system-ui, sans-serif',
    fontMono: '"JetBrains Mono", "Fira Code", monospace',
    fontBody: '"Inter", system-ui, sans-serif',

    // Escala fluida — clamp para responsive sin media queries
    scale: {
      xs: 'clamp(0.7rem, 0.65rem + 0.25vw, 0.8rem)',
      sm: 'clamp(0.8rem, 0.75rem + 0.25vw, 0.9rem)',
      base: 'clamp(0.95rem, 0.9rem + 0.25vw, 1.05rem)',
      lg: 'clamp(1.1rem, 1rem + 0.5vw, 1.25rem)',
      xl: 'clamp(1.4rem, 1.2rem + 1vw, 1.75rem)',
      '2xl': 'clamp(2rem, 1.5rem + 2.5vw, 3rem)',
      '3xl': 'clamp(3rem, 2.2rem + 4vw, 5rem)',
      '4xl': 'clamp(4rem, 3rem + 5vw, 7rem)',
    },

    weights: {
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
      black: 800,
    },

    lineHeights: {
      tight: 1.05,
      snug: 1.15,
      normal: 1.55,
      relaxed: 1.7,
    },

    letterSpacing: {
      tight: '-0.03em',
      normal: '0',
      wide: '0.02em',
      wider: '0.08em',
      tracking: '0.15em',
    },
  },

  // === ESPACIADO ===
  spacing: {
    base: 8, // 8px base unit
    scale: {
      0: 0,
      1: 4,
      2: 8,
      3: 12,
      4: 16,
      5: 20,
      6: 24,
      8: 32,
      10: 40,
      12: 48,
      16: 64,
      20: 80,
      24: 96,
    },
  },

  // === RADIOS ===
  radii: {
    none: 0,
    sm: 6,
    md: 10,
    lg: 16,
    xl: 24,
    '2xl': 32,
    full: 9999,
  },

  // === SOMBRAS Y GLOW ===
  shadows: {
    sm: '0 1px 2px rgba(0,0,0,0.3)',
    md: '0 4px 12px rgba(0,0,0,0.4)',
    lg: '0 12px 32px rgba(0,0,0,0.5)',
    xl: '0 24px 48px rgba(0,0,0,0.6)',
    glow: (color) => `0 0 40px ${color}`,
    glowSm: (color) => `0 0 20px ${color}`,
    inner: 'inset 0 1px 0 rgba(255,255,255,0.05)',
  },

  // === TRANSICIONES ===
  transitions: {
    fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
    normal: '250ms cubic-bezier(0.4, 0, 0.2, 1)',
    slow: '400ms cubic-bezier(0.4, 0, 0.2, 1)',
    spring: '500ms cubic-bezier(0.34, 1.56, 0.64, 1)',
  },

  // === Z-INDEX ===
  zIndex: {
    dropdown: 100,
    sticky: 200,
    modal: 300,
    popover: 400,
    tooltip: 500,
    toast: 600,
  },

  // === BREAKPOINTS (para referencia en JS) ===
  breakpoints: {
    sm: 640,
    md: 768,
    lg: 1024,
    xl: 1280,
    '2xl': 1536,
  },
}

// Helper para obtener tokens de una marca
export function getBrandTokens(brand) {
  return DESIGN_TOKENS.colors[brand] || DESIGN_TOKENS.colors.technostore
}

// Helper para generar CSS variables de una marca
export function generateCSSVariables(brand) {
  const tokens = getBrandTokens(brand)
  return `
    :root {
      --bg: ${tokens.bg};
      --bg-darker: ${tokens.bgDarker};
      --bg-card: ${tokens.bgCard};
      --bg-card-hover: ${tokens.bgCardHover};
      --border: ${tokens.border};
      --border-bright: ${tokens.borderBright};
      --text: ${tokens.text};
      --text-muted: ${tokens.textMuted};
      --text-dim: ${tokens.textDim};
      --primary: ${tokens.primary};
      --secondary: ${tokens.secondary};
      --gradient: ${tokens.gradient};
      --gradient-soft: ${tokens.gradientSoft};
      --glow: ${tokens.glow};
      --glow-secondary: ${tokens.glowSecondary};
      --success: ${tokens.success};
      --warning: ${tokens.warning};
      --error: ${tokens.error};
    }
  `
}

export default DESIGN_TOKENS