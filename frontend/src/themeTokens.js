const CHART_THEME = {
  light: {
    series: {
      primary: '#1976d2',
      secondary: '#0f9f81',
      tertiary: '#dd7a12',
      quaternary: '#7b61ff',
    },
    status: {
      good: '#0f9f81',
      warn: '#dd7a12',
      bad: '#cf2f4e',
      neutral: '#5f7899',
    },
    grid: {
      subtle: '#bfd0e6',
    },
    axis: {
      default: '#4f6585',
    },
    tooltip: {
      bg: '#ffffff',
      text: '#11233d',
    },
    focus: {
      ring: '#1976d2',
    },
    categorical: ['#1976d2', '#0f9f81', '#dd7a12', '#7b61ff', '#b14491', '#4b7e9f'],
    sequential: ['#dbeafe', '#a7d0fb', '#6caef6', '#2c8ae5', '#0f5eb3'],
  },
  dark: {
    series: {
      primary: '#54b8ff',
      secondary: '#41cfa9',
      tertiary: '#f1b15f',
      quaternary: '#b39dff',
    },
    status: {
      good: '#41cfa9',
      warn: '#f1b15f',
      bad: '#ff8ca5',
      neutral: '#a5bedf',
    },
    grid: {
      subtle: '#4b658c',
    },
    axis: {
      default: '#b6ccec',
    },
    tooltip: {
      bg: '#1a2a44',
      text: '#ddedff',
    },
    focus: {
      ring: '#54b8ff',
    },
    categorical: ['#54b8ff', '#41cfa9', '#f1b15f', '#b39dff', '#e886d0', '#7cb6da'],
    sequential: ['#163253', '#1e4f80', '#2673b3', '#3d98d8', '#73c2f5'],
  },
}

export function getChartTheme(resolvedTheme) {
  const base = resolvedTheme === 'dark' ? CHART_THEME.dark : CHART_THEME.light
  return {
    ...base,
    // Backward-compatible aliases for existing chart components.
    gridColor: base.grid.subtle,
    axisColor: base.axis.default,
    tooltipBg: base.tooltip.bg,
    tooltipText: base.tooltip.text,
    planned: base.status.neutral,
    actual: base.series.secondary,
    enquiries: base.series.primary,
    shipments: base.series.secondary,
    conversionA: base.series.primary,
    conversionB: base.series.quaternary,
    pie: base.categorical,
  }
}
