/**
 * Loan Categorization Constants
 *
 * Defines the mapping of FFIEC Call Report loan fields to standardized categories
 * for Consumer vs Business classification with secondary loan type categories.
 *
 * Reference: FFIEC Call Report Schedule RC-C (Loans and Lease Financing Receivables)
 */

/**
 * Primary loan categories
 */
const PRIMARY_CATEGORIES = {
  CONSUMER: 'Consumer',
  BUSINESS: 'Business'
};

/**
 * Secondary loan categories (loan types)
 */
const SECONDARY_CATEGORIES = {
  MORTGAGE: 'Mortgage',
  CREDIT_CARD: 'Credit Card',
  AUTO: 'Auto',
  PERSONAL: 'Personal',
  CONSTRUCTION: 'Construction',
  CRE: 'Commercial Real Estate',
  CI: 'Commercial & Industrial',
  AGRICULTURE: 'Agriculture',
  LEASES: 'Leases',
  OTHER: 'Other'
};

/**
 * MDRM Code mappings for loan portfolio from RC-C Schedule
 * Each entry defines the field path, MDRM code, and categorization
 */
const LOAN_FIELD_MAPPINGS = {
  // ============================================
  // REAL ESTATE LOANS
  // ============================================

  // Construction and Land Development
  constructionResidential: {
    mdrmCode: 'F158',
    fieldPath: 'realEstate.constructionAndLandDevelopment.residential1To4Family',
    primary: PRIMARY_CATEGORIES.CONSUMER,
    secondary: SECONDARY_CATEGORIES.CONSTRUCTION,
    description: '1-4 family residential construction loans',
    notes: 'Residential construction - classified as Consumer'
  },
  constructionOther: {
    mdrmCode: 'F159',
    fieldPath: 'realEstate.constructionAndLandDevelopment.otherConstructionAndLandDevelopment',
    primary: PRIMARY_CATEGORIES.BUSINESS,
    secondary: SECONDARY_CATEGORIES.CONSTRUCTION,
    description: 'Other construction and land development loans',
    notes: 'Commercial construction projects'
  },
  constructionTotal: {
    mdrmCode: '2746',
    fieldPath: 'realEstate.constructionAndLandDevelopment.total',
    primary: null, // Aggregate - split between consumer/business
    secondary: SECONDARY_CATEGORIES.CONSTRUCTION,
    description: 'Total construction and land development',
    isAggregate: true
  },

  // Secured by 1-4 Family Residential
  residential1to4Heloc: {
    mdrmCode: '1797',
    fieldPath: 'realEstate.securedBy1To4Family.revolvingOpenEnd',
    primary: PRIMARY_CATEGORIES.CONSUMER,
    secondary: SECONDARY_CATEGORIES.MORTGAGE,
    description: 'Revolving, open-end loans (HELOCs)',
    notes: 'Home equity lines of credit'
  },
  residential1to4FirstLien: {
    mdrmCode: '5367',
    fieldPath: 'realEstate.securedBy1To4Family.closedEndFirstLiens',
    primary: PRIMARY_CATEGORIES.CONSUMER,
    secondary: SECONDARY_CATEGORIES.MORTGAGE,
    description: 'Closed-end first lien mortgages',
    notes: 'Primary residential mortgages'
  },
  residential1to4JuniorLien: {
    mdrmCode: '5368',
    fieldPath: 'realEstate.securedBy1To4Family.closedEndJuniorLiens',
    primary: PRIMARY_CATEGORIES.CONSUMER,
    secondary: SECONDARY_CATEGORIES.MORTGAGE,
    description: 'Closed-end junior lien mortgages',
    notes: 'Second mortgages, home equity loans'
  },

  // Other Real Estate
  multifamily: {
    mdrmCode: '1460',
    fieldPath: 'realEstate.multifamily',
    primary: PRIMARY_CATEGORIES.BUSINESS,
    secondary: SECONDARY_CATEGORIES.CRE,
    description: 'Multifamily (5+ units) residential properties',
    notes: 'Apartment buildings, multifamily investment properties'
  },
  creOwnerOccupied: {
    mdrmCode: 'F160',
    fieldPath: 'realEstate.nonfarmNonresidential.ownerOccupied',
    primary: PRIMARY_CATEGORIES.BUSINESS,
    secondary: SECONDARY_CATEGORIES.CRE,
    description: 'Owner-occupied nonfarm nonresidential',
    notes: 'Business owner-occupied commercial properties'
  },
  creOther: {
    mdrmCode: 'F161',
    fieldPath: 'realEstate.nonfarmNonresidential.otherNonfarmNonresidential',
    primary: PRIMARY_CATEGORIES.BUSINESS,
    secondary: SECONDARY_CATEGORIES.CRE,
    description: 'Other nonfarm nonresidential',
    notes: 'Investment CRE, retail, office, industrial'
  },
  farmland: {
    mdrmCode: '1420',
    fieldPath: 'realEstate.farmland',
    primary: PRIMARY_CATEGORIES.BUSINESS,
    secondary: SECONDARY_CATEGORIES.AGRICULTURE,
    description: 'Loans secured by farmland',
    notes: 'Agricultural real estate'
  },

  // ============================================
  // COMMERCIAL & INDUSTRIAL LOANS
  // ============================================
  ciUS: {
    mdrmCode: '1763',
    fieldPath: 'commercialAndIndustrial.usAddressees',
    primary: PRIMARY_CATEGORIES.BUSINESS,
    secondary: SECONDARY_CATEGORIES.CI,
    description: 'C&I loans to US addressees',
    notes: 'Business operating loans, lines of credit to US companies'
  },
  ciNonUS: {
    mdrmCode: '1764',
    fieldPath: 'commercialAndIndustrial.nonUsAddressees',
    primary: PRIMARY_CATEGORIES.BUSINESS,
    secondary: SECONDARY_CATEGORIES.CI,
    description: 'C&I loans to non-US addressees',
    notes: 'International business lending'
  },

  // ============================================
  // CONSUMER LOANS
  // ============================================
  creditCards: {
    mdrmCode: 'B537',
    fieldPath: 'consumer.creditCards',
    primary: PRIMARY_CATEGORIES.CONSUMER,
    secondary: SECONDARY_CATEGORIES.CREDIT_CARD,
    description: 'Credit card loans',
    notes: 'IMPORTANT: Includes both consumer AND business credit cards. The Call Report does not separate them.',
    disclaimer: 'This field includes both consumer and commercial credit card receivables as reported on Schedule RC-C.'
  },
  autoLoans: {
    mdrmCode: 'K137',
    fieldPath: 'consumer.automobileLoans',
    primary: PRIMARY_CATEGORIES.CONSUMER,
    secondary: SECONDARY_CATEGORIES.AUTO,
    description: 'Automobile loans',
    notes: 'Direct and indirect auto financing'
  },
  otherRevolvingCredit: {
    mdrmCode: 'B538',
    fieldPath: 'consumer.otherRevolvingCredit',
    primary: PRIMARY_CATEGORIES.CONSUMER,
    secondary: SECONDARY_CATEGORIES.PERSONAL,
    description: 'Other revolving credit plans',
    notes: 'Personal lines of credit, overdraft protection'
  },
  otherConsumerLoans: {
    mdrmCode: 'B539',
    fieldPath: 'consumer.otherConsumerLoans',
    primary: PRIMARY_CATEGORIES.CONSUMER,
    secondary: SECONDARY_CATEGORIES.PERSONAL,
    description: 'Other consumer loans',
    notes: 'Personal loans, student loans, marine/RV loans'
  },

  // ============================================
  // OTHER LOANS
  // ============================================
  agriculturalProduction: {
    mdrmCode: '1590',
    fieldPath: 'other.agriculturalProduction',
    primary: PRIMARY_CATEGORIES.BUSINESS,
    secondary: SECONDARY_CATEGORIES.AGRICULTURE,
    description: 'Agricultural production loans',
    notes: 'Operating loans to farmers, crop financing'
  },
  toDepositoryInstitutions: {
    mdrmCode: '1288',
    fieldPath: 'other.toDepositoryInstitutions',
    primary: PRIMARY_CATEGORIES.BUSINESS,
    secondary: SECONDARY_CATEGORIES.OTHER,
    description: 'Loans to depository institutions',
    notes: 'Interbank lending, fed funds sold'
  },
  toForeignGovernments: {
    mdrmCode: '2081',
    fieldPath: 'other.loansToForeignGovernments',
    primary: PRIMARY_CATEGORIES.BUSINESS,
    secondary: SECONDARY_CATEGORIES.OTHER,
    description: 'Loans to foreign governments',
    notes: 'Sovereign lending'
  },
  municipalLoans: {
    mdrmCode: '2107',
    fieldPath: 'other.municipalLoans',
    primary: PRIMARY_CATEGORIES.BUSINESS,
    secondary: SECONDARY_CATEGORIES.OTHER,
    description: 'Loans to states and political subdivisions',
    notes: 'Municipal financing'
  },
  otherLoansUS: {
    mdrmCode: 'B534',
    fieldPath: 'other.loansToOtherDepositoryUS',
    primary: PRIMARY_CATEGORIES.BUSINESS,
    secondary: SECONDARY_CATEGORIES.OTHER,
    description: 'Loans to other US depository institutions',
    notes: 'Interbank domestic'
  },
  otherLoansForeign: {
    mdrmCode: 'B535',
    fieldPath: 'other.loansToBanksForeign',
    primary: PRIMARY_CATEGORIES.BUSINESS,
    secondary: SECONDARY_CATEGORIES.OTHER,
    description: 'Loans to foreign banks',
    notes: 'Interbank international'
  },
  allOtherLoans: {
    mdrmCode: 'A570',
    fieldPath: 'other.allOtherLoans',
    primary: PRIMARY_CATEGORIES.BUSINESS,
    secondary: SECONDARY_CATEGORIES.OTHER,
    description: 'All other loans',
    notes: 'Catch-all for loans not elsewhere classified'
  },

  // ============================================
  // LEASE FINANCING RECEIVABLES
  // ============================================
  consumerLeases: {
    mdrmCode: 'F162',
    fieldPath: 'leaseFinancingReceivables.consumerLeases',
    primary: PRIMARY_CATEGORIES.CONSUMER,
    secondary: SECONDARY_CATEGORIES.LEASES,
    description: 'Lease financing receivables - Consumer',
    notes: 'Consumer auto leases, equipment leases to individuals'
  },
  otherLeases: {
    mdrmCode: 'F163',
    fieldPath: 'leaseFinancingReceivables.allOtherLeases',
    primary: PRIMARY_CATEGORIES.BUSINESS,
    secondary: SECONDARY_CATEGORIES.LEASES,
    description: 'Lease financing receivables - All other',
    notes: 'Commercial equipment leases, business vehicle leases'
  }
};

/**
 * Credit Quality MDRM codes from RC-N Schedule
 * For past due, nonaccrual, and charge-off data
 */
const CREDIT_QUALITY_MAPPINGS = {
  // Past Due 30-89 Days (still accruing)
  pastDue30to89: {
    realEstateConstruction: { mdrmCode: '2759', description: 'Construction - 30-89 days past due' },
    realEstate1to4Family: { mdrmCode: '5398', description: '1-4 Family - 30-89 days past due' },
    realEstateMultifamily: { mdrmCode: '3499', description: 'Multifamily - 30-89 days past due' },
    realEstateCRE: { mdrmCode: '3500', description: 'CRE - 30-89 days past due' },
    realEstateFarmland: { mdrmCode: '3501', description: 'Farmland - 30-89 days past due' },
    ci: { mdrmCode: '1607', description: 'C&I - 30-89 days past due' },
    consumer: { mdrmCode: '1609', description: 'Consumer - 30-89 days past due' },
    creditCards: { mdrmCode: 'K129', description: 'Credit Cards - 30-89 days past due' },
    autoLoans: { mdrmCode: 'K205', description: 'Auto Loans - 30-89 days past due' },
    otherConsumer: { mdrmCode: 'K206', description: 'Other Consumer - 30-89 days past due' },
    agricultural: { mdrmCode: '1594', description: 'Agricultural - 30-89 days past due' },
    leases: { mdrmCode: '1611', description: 'Leases - 30-89 days past due' },
    other: { mdrmCode: '1613', description: 'Other - 30-89 days past due' }
  },

  // Past Due 90+ Days (still accruing)
  pastDue90Plus: {
    realEstateConstruction: { mdrmCode: '2769', description: 'Construction - 90+ days past due' },
    realEstate1to4Family: { mdrmCode: '5399', description: '1-4 Family - 90+ days past due' },
    realEstateMultifamily: { mdrmCode: '3502', description: 'Multifamily - 90+ days past due' },
    realEstateCRE: { mdrmCode: '3503', description: 'CRE - 90+ days past due' },
    realEstateFarmland: { mdrmCode: '3504', description: 'Farmland - 90+ days past due' },
    ci: { mdrmCode: '1608', description: 'C&I - 90+ days past due' },
    consumer: { mdrmCode: '1610', description: 'Consumer - 90+ days past due' },
    creditCards: { mdrmCode: 'K130', description: 'Credit Cards - 90+ days past due' },
    autoLoans: { mdrmCode: 'K207', description: 'Auto Loans - 90+ days past due' },
    otherConsumer: { mdrmCode: 'K208', description: 'Other Consumer - 90+ days past due' },
    agricultural: { mdrmCode: '1597', description: 'Agricultural - 90+ days past due' },
    leases: { mdrmCode: '1612', description: 'Leases - 90+ days past due' },
    other: { mdrmCode: '1614', description: 'Other - 90+ days past due' }
  },

  // Nonaccrual
  nonaccrual: {
    realEstateConstruction: { mdrmCode: '3505', description: 'Construction - Nonaccrual' },
    realEstate1to4Family: { mdrmCode: '3506', description: '1-4 Family - Nonaccrual' },
    realEstateMultifamily: { mdrmCode: '3507', description: 'Multifamily - Nonaccrual' },
    realEstateCRE: { mdrmCode: '3508', description: 'CRE - Nonaccrual' },
    realEstateFarmland: { mdrmCode: '3509', description: 'Farmland - Nonaccrual' },
    ci: { mdrmCode: '1227', description: 'C&I - Nonaccrual' },
    consumer: { mdrmCode: '1228', description: 'Consumer - Nonaccrual' },
    creditCards: { mdrmCode: 'K131', description: 'Credit Cards - Nonaccrual' },
    autoLoans: { mdrmCode: 'K209', description: 'Auto Loans - Nonaccrual' },
    otherConsumer: { mdrmCode: 'K210', description: 'Other Consumer - Nonaccrual' },
    agricultural: { mdrmCode: '1583', description: 'Agricultural - Nonaccrual' },
    leases: { mdrmCode: '1229', description: 'Leases - Nonaccrual' },
    other: { mdrmCode: '1230', description: 'Other - Nonaccrual' }
  },

  // Charge-offs (from RC-K and RI-B)
  chargeOffs: {
    total: { mdrmCode: '4635', description: 'Total charge-offs' },
    realEstate: { mdrmCode: '4651', description: 'Real estate charge-offs' },
    ci: { mdrmCode: '4645', description: 'C&I charge-offs' },
    consumer: { mdrmCode: '4648', description: 'Consumer charge-offs' },
    creditCards: { mdrmCode: 'C891', description: 'Credit card charge-offs' },
    agricultural: { mdrmCode: '4655', description: 'Agricultural charge-offs' },
    leases: { mdrmCode: '4658', description: 'Lease charge-offs' }
  },

  // Recoveries (from RC-K and RI-B)
  recoveries: {
    total: { mdrmCode: '4605', description: 'Total recoveries' },
    realEstate: { mdrmCode: '4661', description: 'Real estate recoveries' },
    ci: { mdrmCode: '4617', description: 'C&I recoveries' },
    consumer: { mdrmCode: '4628', description: 'Consumer recoveries' },
    creditCards: { mdrmCode: 'C893', description: 'Credit card recoveries' },
    agricultural: { mdrmCode: '4665', description: 'Agricultural recoveries' },
    leases: { mdrmCode: '4668', description: 'Lease recoveries' }
  }
};

/**
 * Validation totals - Summary fields for data validation
 */
const VALIDATION_TOTALS = {
  totalRealEstateLoans: { mdrmCode: '1410', description: 'Total loans secured by real estate' },
  totalLoansGross: { mdrmCode: 'B528', description: 'Total loans and leases, gross' },
  totalLoansNet: { mdrmCode: '2122', description: 'Total loans and leases, net of unearned income' },
  allowanceForLosses: { mdrmCode: 'B529', description: 'Allowance for loan and lease losses' }
};

/**
 * Get all fields for a given primary category
 * @param {string} category - 'Consumer' or 'Business'
 * @returns {Array} Array of field mappings
 */
function getFieldsByPrimaryCategory(category) {
  return Object.entries(LOAN_FIELD_MAPPINGS)
    .filter(([_, mapping]) => mapping.primary === category)
    .map(([key, mapping]) => ({ key, ...mapping }));
}

/**
 * Get all fields for a given secondary category
 * @param {string} category - e.g., 'Mortgage', 'Credit Card', 'Auto'
 * @returns {Array} Array of field mappings
 */
function getFieldsBySecondaryCategory(category) {
  return Object.entries(LOAN_FIELD_MAPPINGS)
    .filter(([_, mapping]) => mapping.secondary === category)
    .map(([key, mapping]) => ({ key, ...mapping }));
}

/**
 * Calculate categorized loan totals from a portfolio object
 * @param {Object} portfolio - The loan portfolio data
 * @returns {Object} Categorized totals with consumer/business breakdown
 */
function calculateCategorizedTotals(portfolio) {
  const result = {
    consumer: {
      total: 0,
      mortgage: 0,
      creditCard: 0,
      auto: 0,
      personal: 0,
      leases: 0,
      construction: 0
    },
    business: {
      total: 0,
      cre: 0,
      ci: 0,
      agriculture: 0,
      construction: 0,
      leases: 0,
      other: 0
    },
    disclaimers: []
  };

  // Helper to safely get nested value
  const getValue = (obj, path) => {
    return path.split('.').reduce((acc, part) => acc?.[part], obj) || 0;
  };

  // Process each field mapping
  Object.entries(LOAN_FIELD_MAPPINGS).forEach(([key, mapping]) => {
    if (mapping.isAggregate) return; // Skip aggregate fields

    const value = getValue(portfolio, mapping.fieldPath);
    if (!value || isNaN(value)) return;

    const primaryKey = mapping.primary === PRIMARY_CATEGORIES.CONSUMER ? 'consumer' : 'business';
    result[primaryKey].total += value;

    // Add to secondary category
    switch (mapping.secondary) {
      case SECONDARY_CATEGORIES.MORTGAGE:
        result.consumer.mortgage += value;
        break;
      case SECONDARY_CATEGORIES.CREDIT_CARD:
        result.consumer.creditCard += value;
        if (mapping.disclaimer) {
          result.disclaimers.push(mapping.disclaimer);
        }
        break;
      case SECONDARY_CATEGORIES.AUTO:
        result.consumer.auto += value;
        break;
      case SECONDARY_CATEGORIES.PERSONAL:
        result.consumer.personal += value;
        break;
      case SECONDARY_CATEGORIES.CRE:
        result.business.cre += value;
        break;
      case SECONDARY_CATEGORIES.CI:
        result.business.ci += value;
        break;
      case SECONDARY_CATEGORIES.AGRICULTURE:
        result.business.agriculture += value;
        break;
      case SECONDARY_CATEGORIES.CONSTRUCTION:
        if (mapping.primary === PRIMARY_CATEGORIES.CONSUMER) {
          result.consumer.construction += value;
        } else {
          result.business.construction += value;
        }
        break;
      case SECONDARY_CATEGORIES.LEASES:
        if (mapping.primary === PRIMARY_CATEGORIES.CONSUMER) {
          result.consumer.leases += value;
        } else {
          result.business.leases += value;
        }
        break;
      case SECONDARY_CATEGORIES.OTHER:
        result.business.other += value;
        break;
    }
  });

  // Dedupe disclaimers
  result.disclaimers = [...new Set(result.disclaimers)];

  return result;
}

/**
 * Get display-friendly breakdown for UI
 * @param {Object} portfolio - The loan portfolio data
 * @returns {Object} Formatted data for charts and tables
 */
function getUIBreakdown(portfolio) {
  const categorized = calculateCategorizedTotals(portfolio);
  const grandTotal = categorized.consumer.total + categorized.business.total;

  return {
    summary: {
      consumerTotal: categorized.consumer.total,
      consumerPct: grandTotal > 0 ? (categorized.consumer.total / grandTotal) * 100 : 0,
      businessTotal: categorized.business.total,
      businessPct: grandTotal > 0 ? (categorized.business.total / grandTotal) * 100 : 0,
      grandTotal
    },
    consumer: {
      mortgage: { value: categorized.consumer.mortgage, label: 'Mortgages' },
      creditCard: { value: categorized.consumer.creditCard, label: 'Credit Cards', hasDisclaimer: true },
      auto: { value: categorized.consumer.auto, label: 'Auto Loans' },
      personal: { value: categorized.consumer.personal, label: 'Personal/Other' },
      leases: { value: categorized.consumer.leases, label: 'Consumer Leases' },
      construction: { value: categorized.consumer.construction, label: 'Residential Construction' }
    },
    business: {
      cre: { value: categorized.business.cre, label: 'Commercial Real Estate' },
      ci: { value: categorized.business.ci, label: 'Commercial & Industrial' },
      agriculture: { value: categorized.business.agriculture, label: 'Agriculture' },
      construction: { value: categorized.business.construction, label: 'Commercial Construction' },
      leases: { value: categorized.business.leases, label: 'Commercial Leases' },
      other: { value: categorized.business.other, label: 'Other Business' }
    },
    disclaimers: categorized.disclaimers
  };
}

module.exports = {
  PRIMARY_CATEGORIES,
  SECONDARY_CATEGORIES,
  LOAN_FIELD_MAPPINGS,
  CREDIT_QUALITY_MAPPINGS,
  VALIDATION_TOTALS,
  getFieldsByPrimaryCategory,
  getFieldsBySecondaryCategory,
  calculateCategorizedTotals,
  getUIBreakdown
};
