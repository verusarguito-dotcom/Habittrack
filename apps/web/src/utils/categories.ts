/**
 * Semantic category color mappings according to DESIGN_SYSTEM.md
 */

export interface CategoryTheme {
  name: string;
  dotColor: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
}

export function getCategoryTheme(categoryName?: string | null): CategoryTheme {
  const norm = (categoryName || '').toLowerCase().trim();

  if (norm.includes('sehat') || norm.includes('health') || norm.includes('hidrasi')) {
    return {
      name: categoryName || 'Kesehatan',
      dotColor: 'bg-emerald-600 dark:bg-emerald-400',
      badgeBg: 'bg-emerald-50 dark:bg-emerald-950/40',
      badgeText: 'text-emerald-700 dark:text-emerald-300',
      badgeBorder: 'border-emerald-200 dark:border-emerald-800/40'
    };
  }

  if (norm.includes('karir') || norm.includes('kerja') || norm.includes('produk') || norm.includes('career')) {
    return {
      name: categoryName || 'Produktivitas',
      dotColor: 'bg-indigo-600 dark:bg-indigo-400',
      badgeBg: 'bg-indigo-50 dark:bg-indigo-950/40',
      badgeText: 'text-indigo-700 dark:text-indigo-300',
      badgeBorder: 'border-indigo-200 dark:border-indigo-800/40'
    };
  }

  if (norm.includes('pikir') || norm.includes('mental') || norm.includes('belajar') || norm.includes('mind') || norm.includes('kognisi')) {
    return {
      name: categoryName || 'Pikiran & Mental',
      dotColor: 'bg-sky-600 dark:bg-sky-400',
      badgeBg: 'bg-sky-50 dark:bg-sky-950/40',
      badgeText: 'text-sky-700 dark:text-sky-300',
      badgeBorder: 'border-sky-200 dark:border-sky-800/40'
    };
  }

  if (norm.includes('bugar') || norm.includes('olahraga') || norm.includes('fitness') || norm.includes('jalan')) {
    return {
      name: categoryName || 'Kebugaran',
      dotColor: 'bg-rose-600 dark:bg-rose-400',
      badgeBg: 'bg-rose-50 dark:bg-rose-950/40',
      badgeText: 'text-rose-700 dark:text-rose-300',
      badgeBorder: 'border-rose-200 dark:border-rose-800/40'
    };
  }

  if (norm.includes('finansial') || norm.includes('keuangan') || norm.includes('hemat') || norm.includes('finance')) {
    return {
      name: categoryName || 'Finansial',
      dotColor: 'bg-lime-600 dark:bg-lime-400',
      badgeBg: 'bg-lime-50 dark:bg-lime-950/40',
      badgeText: 'text-lime-700 dark:text-lime-300',
      badgeBorder: 'border-lime-200 dark:border-lime-800/40'
    };
  }

  // Default neutral slate
  return {
    name: categoryName || 'Umum',
    dotColor: 'bg-slate-500 dark:bg-slate-400',
    badgeBg: 'bg-slate-100 dark:bg-slate-800',
    badgeText: 'text-slate-700 dark:text-slate-300',
    badgeBorder: 'border-slate-200 dark:border-slate-700'
  };
}
