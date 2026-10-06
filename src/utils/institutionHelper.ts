export type AccountType = 'institutional' | 'regular_work';

export interface AccountInfo {
  institutionName: string;
  isInstitutional: boolean;
  domain: string;
  accountType: AccountType;
  badgeLabel: string;
  detectionScope: string;
}

export function getInstitutionInfo(email?: string | null): AccountInfo {
  if (!email || !email.includes('@')) {
    return {
      institutionName: 'Universal Workspace',
      isInstitutional: false,
      domain: '',
      accountType: 'regular_work',
      badgeLabel: 'Google Workspace',
      detectionScope: 'Google Tasks, Calendar & connected productivity apps',
    };
  }

  const domain = email.split('@')[1]?.toLowerCase() || '';

  // Standard regular Gmail account (students, working professionals, freelancers)
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    return {
      institutionName: 'Work & Personal Workspace',
      isInstitutional: false,
      domain: 'gmail.com',
      accountType: 'regular_work',
      badgeLabel: 'Regular Gmail · Work & Tasks Active',
      detectionScope: 'Google Tasks (Gmail add-ons, connected task apps) & Calendar deadlines',
    };
  }

  // Well-known school domain map
  const knownDomains: Record<string, string> = {
    'paterostechnologicalcollege.edu.ph': 'Pateros Technological College',
    'ptc.edu.ph': 'Pateros Technological College',
    'up.edu.ph': 'University of the Philippines',
    'ust.edu.ph': 'University of Santo Tomas',
    'dlsu.edu.ph': 'De La Salle University',
    'ateneo.edu': 'Ateneo de Manila University',
    'pup.edu.ph': 'Polytechnic University of the Philippines',
    'plm.edu.ph': 'Pamantasan ng Lungsod ng Maynila',
    'feu.edu.ph': 'Far Eastern University',
    'mapua.edu.ph': 'Mapúa University',
    'tip.edu.ph': 'Technological Institute of the Philippines',
    'tup.edu.ph': 'Technological University of the Philippines',
    'adamson.edu.ph': 'Adamson University',
    'neu.edu.ph': 'New Era University',
    'rtu.edu.ph': 'Rizal Technological University',
    'stanford.edu': 'Stanford University',
    'mit.edu': 'MIT',
    'harvard.edu': 'Harvard University',
    'berkeley.edu': 'UC Berkeley',
  };

  if (knownDomains[domain]) {
    return {
      institutionName: knownDomains[domain],
      isInstitutional: true,
      domain,
      accountType: 'institutional',
      badgeLabel: `${knownDomains[domain]} (Institutional)`,
      detectionScope: 'Google Classroom coursework, assignments, and Academic Calendar',
    };
  }

  const isEdu =
    domain.endsWith('.edu') ||
    domain.endsWith('.edu.ph') ||
    domain.endsWith('.ac.uk') ||
    domain.endsWith('.edu.au') ||
    domain.endsWith('.edu.sg') ||
    domain.endsWith('.school');

  // Convert generic domain like "mycollege.edu.ph" or "mycompany.com"
  const cleanName = domain
    .replace(/\.edu(\.[a-z]{2})?$/, '')
    .replace(/\.ac(\.[a-z]{2})?$/, '')
    .replace(/\.(com|org|net|io|co)$/, '')
    .split('.')[0]
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

  if (isEdu) {
    return {
      institutionName: `${cleanName} (Campus)`,
      isInstitutional: true,
      domain,
      accountType: 'institutional',
      badgeLabel: `${cleanName} Institutional Portal`,
      detectionScope: 'Google Classroom coursework, active syllabi, and Academic Calendar',
    };
  }

  // Corporate / Organization / Work Google Workspace
  return {
    institutionName: `${cleanName} Workspace`,
    isInstitutional: false,
    domain,
    accountType: 'regular_work',
    badgeLabel: `${cleanName} Professional Workspace`,
    detectionScope: 'Google Tasks, Calendar milestones & connected productivity apps',
  };
}
