const CHART_THEME = {
  light: {
    grid: '#bfd0e6',
    axis: '#5e7698',
    tooltipBg: '#ffffff',
    tooltipText: '#11233d',
    planned: '#6b7f9c',
    actual: '#1ea2e6',
    enquiries: '#0d85cb',
    shipments: '#0f9f81',
    conversionA: '#2788f0',
    conversionB: '#8d6bf6',
    pie: ['#1ea2e6', '#14b894', '#f2a231', '#8d6bf6'],
  },
  dark: {
    grid: '#3f5b82',
    axis: '#a6c5ea',
    tooltipBg: '#1a2a44',
    tooltipText: '#ddedff',
    planned: '#93abc9',
    actual: '#43c0ff',
    enquiries: '#66cfff',
    shipments: '#4cd7b7',
    conversionA: '#6db0ff',
    conversionB: '#b69cff',
    pie: ['#43c0ff', '#4cd7b7', '#f9bd67', '#b69cff'],
  },
}

export function getChartTheme(resolvedTheme) {
  return resolvedTheme === 'dark' ? CHART_THEME.dark : CHART_THEME.light
}
