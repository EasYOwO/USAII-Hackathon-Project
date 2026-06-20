export type AssistantLanguage = 'en' | 'zh';

export type ApplicantProfile = {
  name?: string;
  icNumber?: string;
  phone?: string;
  age?: string;
  state?: string;
  postcode?: string;
  taman?: string;
  addressLine?: string;
  maritalStatus?: string;
  children?: string;
  householdIncome?: string;
  disability?: string;
  housingStatus?: string;
  medicalNeed?: string;
  rentalArrears?: string;
};

export type LocalizedText = {
  en: string;
  zh: string;
};

export type ApplicationSection = 'personal' | 'address' | 'household' | 'financial' | 'documents';

export type ApplicationField = {
  id: string;
  label: LocalizedText;
  question: LocalizedText;
  section: ApplicationSection;
  profileKey?: keyof ApplicantProfile;
  required: boolean;
  options?: Array<{
    value: string;
    label: LocalizedText;
  }>;
};

export type AssistanceForm = {
  id: string;
  title: LocalizedText;
  agency: LocalizedText;
  category: LocalizedText;
  updatedAt: string;
  description: LocalizedText;
  keyConditions: LocalizedText[];
  simpleExplanation: LocalizedText;
  legalNotes: LocalizedText[];
  requiredFields: ApplicationField[];
  consentItems: LocalizedText[];
  progressGuide: LocalizedText[];
};

export type EligibilityStatus = 'likely' | 'needs-info' | 'not-likely';

export type LocalizedForm = {
  id: string;
  title: string;
  agency: string;
  category: string;
  updatedAt: string;
  description: string;
  keyConditions: string[];
  simpleExplanation: string;
  legalNotes: string[];
  requiredFields: Array<{
    id: string;
    label: string;
    question: string;
    section: ApplicationSection;
    profileKey?: keyof ApplicantProfile;
    required: boolean;
    options?: Array<{
      value: string;
      label: string;
    }>;
  }>;
  consentItems: string[];
  progressGuide: string[];
};

export type SearchResult = {
  form: LocalizedForm;
  status: EligibilityStatus;
  score: number;
  matchedReasons: string[];
  missingInfo: string[];
  blockingReasons: string[];
};

export type ApplicationPackage = {
  referenceId: string;
  form: LocalizedForm;
  applicantName: string;
  phone: string;
  icNumber: string;
  fields: Array<{
    id: string;
    label: string;
    section: ApplicationSection;
    value: string;
    required: boolean;
  }>;
  missingFields: string[];
  consents: Array<{
    label: string;
    accepted: boolean;
  }>;
  volunteer: {
    name: string;
    confidentiality: string;
  };
  smsPreview: string;
};

const sectionOrder: ApplicationSection[] = ['personal', 'address', 'household', 'financial', 'documents'];

const commonConsentItems: LocalizedText[] = [
  {
    en: 'I agree that this application draft can be prepared for review before any official submission.',
    zh: '我同意网站先为我准备申请草稿，正式提交前还需要进一步确认。',
  },
  {
    en: 'I authorize relevant parties to verify my household, eligibility, and supporting information where required.',
    zh: '我授权相关单位在需要时核对我的家庭、资格与证明资料。',
  },
  {
    en: 'I agree that the information provided are accurate and legitimate. The information will be reviewed by members of the Malaysian Translator Association working as translation executive within the government sector.',
    zh: '我同意所提供的资料准确且真实。资料将由马来西亚翻译协会在政府部门担任翻译执行员的成员审核。',
  },
];

const baseFields: ApplicationField[] = [
  {
    id: 'name',
    label: { en: 'Full name', zh: '姓名' },
    question: {
      en: 'Please tell me your full name as it should appear on the form.',
      zh: '请告诉我表格上要填写的姓名。',
    },
    section: 'personal',
    profileKey: 'name',
    required: true,
  },
  {
    id: 'phone',
    label: { en: 'Phone number', zh: '电话号码' },
    question: {
      en: 'What phone number should the volunteer use to contact you?',
      zh: '志愿者之后应该用哪个电话号码联系您？',
    },
    section: 'personal',
    profileKey: 'phone',
    required: true,
  },
  {
    id: 'icNumber',
    label: { en: 'IC / ID number', zh: '身份证号码' },
    question: {
      en: 'What is your IC or ID number?',
      zh: '请问您的身份证号码是什么？',
    },
    section: 'personal',
    profileKey: 'icNumber',
    required: true,
  },
  {
    id: 'age',
    label: { en: 'Age', zh: '年龄' },
    question: { en: 'How old are you this year?', zh: '您今年贵庚？' },
    section: 'personal',
    profileKey: 'age',
    required: true,
  },
  {
    id: 'state',
    label: { en: 'State', zh: '州属' },
    question: { en: 'Which state do you live in?', zh: '您住在哪一个州属？' },
    section: 'address',
    profileKey: 'state',
    required: true,
  },
  {
    id: 'postcode',
    label: { en: 'Postcode', zh: '邮编' },
    question: { en: 'What is your postcode?', zh: '您的邮编是多少？' },
    section: 'address',
    profileKey: 'postcode',
    required: true,
  },
  {
    id: 'taman',
    label: { en: 'Taman / area', zh: '花园 / 地区' },
    question: { en: 'What is your taman or area name?', zh: '您的花园或地区名称是什么？' },
    section: 'address',
    profileKey: 'taman',
    required: true,
  },
  {
    id: 'addressLine',
    label: { en: 'Street address', zh: '门牌与街道地址' },
    question: {
      en: 'Please say the house number and street address.',
      zh: '请说出您的门牌号码和街道地址。',
    },
    section: 'address',
    profileKey: 'addressLine',
    required: true,
  },
  {
    id: 'maritalStatus',
    label: { en: 'Marital status', zh: '婚姻状况' },
    question: { en: 'What is your marital status?', zh: '您的婚姻状况是什么？' },
    section: 'household',
    profileKey: 'maritalStatus',
    required: true,
    options: [
      { value: 'single', label: { en: 'Single', zh: '单身' } },
      { value: 'married', label: { en: 'Married', zh: '已婚' } },
      { value: 'widowed', label: { en: 'Widowed', zh: '丧偶' } },
      { value: 'divorced', label: { en: 'Divorced', zh: '离婚' } },
    ],
  },
  {
    id: 'children',
    label: { en: 'Children / dependants', zh: '孩子 / 受扶养人数' },
    question: {
      en: 'How many children or dependants live under your care?',
      zh: '您照顾的孩子或受扶养人数有几位？',
    },
    section: 'household',
    profileKey: 'children',
    required: true,
  },
  {
    id: 'householdIncome',
    label: { en: 'Monthly household income', zh: '每月家庭收入' },
    question: {
      en: 'About how much is the total household income per month?',
      zh: '每月家庭总收入大概是多少？',
    },
    section: 'financial',
    profileKey: 'householdIncome',
    required: true,
  },
  {
    id: 'housingStatus',
    label: { en: 'Housing status', zh: '住房状况' },
    question: { en: 'Do you own, rent, or stay with family?', zh: '您是自住、租屋，还是和家人同住？' },
    section: 'household',
    profileKey: 'housingStatus',
    required: true,
    options: [
      { value: 'rent', label: { en: 'Rent', zh: '租屋' } },
      { value: 'own', label: { en: 'Own home', zh: '自住房屋' } },
      { value: 'family', label: { en: 'Stay with family', zh: '和家人同住' } },
      { value: 'temporary', label: { en: 'Temporary housing', zh: '临时住处' } },
    ],
  },
];

const bankFields: ApplicationField[] = [
  {
    id: 'bankName',
    label: { en: 'Bank name', zh: '银行名称' },
    question: { en: 'Which bank account should receive the payment?', zh: '援助金应该汇入哪一家银行？' },
    section: 'financial',
    required: true,
  },
  {
    id: 'bankAccount',
    label: { en: 'Bank account number', zh: '银行户口号码' },
    question: { en: 'Please provide the bank account number.', zh: '请提供银行户口号码。' },
    section: 'financial',
    required: true,
  },
];

const documentField: ApplicationField = {
  id: 'documentsReady',
  label: { en: 'Documents ready', zh: '文件是否齐全' },
  question: {
    en: 'Do you have your identity card, income proof, and address proof ready?',
    zh: '您是否已有身份证、收入证明和地址证明？',
  },
  section: 'documents',
  required: true,
  options: [
    { value: 'yes', label: { en: 'Yes', zh: '有' } },
    { value: 'partial', label: { en: 'Some documents', zh: '有一部分' } },
    { value: 'no', label: { en: 'Not yet', zh: '还没有' } },
  ],
};

export const assistanceForms: AssistanceForm[] = [
  {
    id: 'senior-living-support',
    title: { en: 'Senior Living Support Aid', zh: '乐龄生活援助金' },
    agency: { en: 'Community Welfare Desk', zh: '社区福利柜台' },
    category: { en: 'Living support', zh: '生活援助' },
    updatedAt: '2026-06-18',
    description: {
      en: 'Monthly support for older residents in low-income households.',
      zh: '为低收入家庭中的长者提供每月生活援助。',
    },
    keyConditions: [
      { en: 'Applicant is 60 years old or above.', zh: '申请者年龄为 60 岁或以上。' },
      { en: 'Monthly household income is RM3,000 or below.', zh: '每月家庭收入 RM3,000 或以下。' },
      { en: 'Requires identity, address, and income proof.', zh: '需要身份证明、住址证明和收入证明。' },
    ],
    simpleExplanation: {
      en: 'This form is for seniors who need help with daily living costs. It focuses on identity, age, income, and supporting documents.',
      zh: '这份表格适合需要生活费帮助的长者，重点核对身份、年龄、收入和所需文件。',
    },
    legalNotes: [
      {
        en: 'Final approval depends on the official agency checking the original documents.',
        zh: '最终批准需由官方单位核对原始文件后决定。',
      },
      {
        en: 'False information may cause the application to be rejected or cancelled.',
        zh: '若资料不实，申请可能会被拒绝或取消。',
      },
    ],
    requiredFields: [...baseFields, ...bankFields, documentField],
    consentItems: commonConsentItems,
    progressGuide: [
      {
        en: 'Open the welfare portal home page.',
        zh: '进入福利申请网站首页。',
      },
      {
        en: 'Tap the green square button at the top right labelled "Application Status".',
        zh: '点击右上角绿色方形按钮「申请进度」。',
      },
      {
        en: 'Enter your IC number and reference ID, then tap "Search".',
        zh: '输入身份证号码和申请编号，然后点击「查询」。',
      },
    ],
  },
  {
    id: 'single-parent-family-aid',
    title: { en: 'Single Parent Family Aid', zh: '单亲家庭援助金' },
    agency: { en: 'Family Services Counter', zh: '家庭服务柜台' },
    category: { en: 'Family support', zh: '家庭援助' },
    updatedAt: '2026-06-18',
    description: {
      en: 'Support for single, widowed, or divorced guardians who care for children or dependants.',
      zh: '为单身、丧偶或离婚并照顾孩子或受扶养人的监护人提供援助。',
    },
    keyConditions: [
      { en: 'Applicant is single, widowed, divorced, or separated.', zh: '申请者为单身、丧偶、离婚或分居。' },
      { en: 'Has at least one child or dependant under care.', zh: '至少照顾一位孩子或受扶养人。' },
      { en: 'Monthly household income is RM4,500 or below.', zh: '每月家庭收入 RM4,500 或以下。' },
    ],
    simpleExplanation: {
      en: 'This form helps guardians who are raising children without a spouse. It focuses on family status, number of dependants, and household income.',
      zh: '这份表格帮助没有配偶、独自照顾孩子的监护人。重点会看婚姻状况、受扶养人数和家庭收入。',
    },
    legalNotes: [
      {
        en: 'The agency may request child birth certificates or guardianship documents.',
        zh: '单位可能要求孩子报生纸或监护文件。',
      },
      {
        en: 'Household income must be declared honestly.',
        zh: '家庭收入必须如实申报。',
      },
    ],
    requiredFields: [
      ...baseFields,
      {
        id: 'youngestChildAge',
        label: { en: 'Youngest child age', zh: '最小孩子年龄' },
        question: { en: 'How old is the youngest child or dependant?', zh: '最小的孩子或受扶养人几岁？' },
        section: 'household',
        required: true,
      },
      ...bankFields,
      documentField,
    ],
    consentItems: commonConsentItems,
    progressGuide: [
      { en: 'Open the family aid portal.', zh: '进入家庭援助网站。' },
      { en: 'Choose "Check Status" from the top right green button.', zh: '点击右上角绿色按钮「查询进度」。' },
      { en: 'Enter your IC number and reference ID.', zh: '输入身份证号码和申请编号。' },
    ],
  },
  {
    id: 'medical-mobility-grant',
    title: { en: 'Medical and Mobility Grant', zh: '医疗与行动辅助津贴' },
    agency: { en: 'Health Support Desk', zh: '健康支援柜台' },
    category: { en: 'Medical support', zh: '医疗援助' },
    updatedAt: '2026-06-18',
    description: {
      en: 'One-off support for medical equipment, mobility aids, or disability-related needs.',
      zh: '为医疗器材、行动辅助用品或残障相关需要提供一次性援助。',
    },
    keyConditions: [
      { en: 'Applicant is 60+ or has a disability or medical mobility need.', zh: '申请者为 60 岁以上，或有残障 / 行动医疗需要。' },
      { en: 'Monthly household income is RM5,000 or below.', zh: '每月家庭收入 RM5,000 或以下。' },
      { en: 'Requires medical note, quotation, or support document where available.', zh: '如有，需要医疗证明、报价单或相关文件。' },
    ],
    simpleExplanation: {
      en: 'This form is for people who need help paying for medical or mobility items, such as a wheelchair, walking frame, or special treatment support.',
      zh: '这份表格适合需要医疗或行动辅助用品的人，例如轮椅、助行架或特别治疗支援。',
    },
    legalNotes: [
      {
        en: 'The agency can ask for a medical note or supplier quotation before approval.',
        zh: '单位可能在批准前要求医疗证明或供应商报价单。',
      },
      {
        en: 'Approved payment may go to the applicant or directly to a supplier depending on the programme.',
        zh: '批准款项可能发给申请者，或按计划直接付给供应商。',
      },
    ],
    requiredFields: [
      ...baseFields,
      {
        id: 'medicalNeed',
        label: { en: 'Medical or mobility need', zh: '医疗或行动需要' },
        question: {
          en: 'What medical or mobility item do you need help with?',
          zh: '您需要哪一种医疗或行动辅助帮助？',
        },
        section: 'documents',
        profileKey: 'medicalNeed',
        required: true,
      },
      {
        id: 'estimatedCost',
        label: { en: 'Estimated cost', zh: '预计费用' },
        question: { en: 'What is the estimated cost, if you know it?', zh: '如果知道的话，预计费用是多少？' },
        section: 'financial',
        required: false,
      },
      documentField,
    ],
    consentItems: commonConsentItems,
    progressGuide: [
      { en: 'Open the health support portal.', zh: '进入健康支援网站。' },
      { en: 'Tap "Status" on the top right green square button.', zh: '点击右上角绿色方形按钮「进度」。' },
      { en: 'Use your IC number and reference ID to search.', zh: '使用身份证号码和申请编号查询。' },
    ],
  },
  {
    id: 'rental-utility-relief',
    title: { en: 'Rental and Utility Relief', zh: '租金与水电援助' },
    agency: { en: 'Housing Assistance Desk', zh: '住房援助柜台' },
    category: { en: 'Housing support', zh: '住房援助' },
    updatedAt: '2026-06-18',
    description: {
      en: 'Short-term help for households who rent and have difficulty paying rent or utilities.',
      zh: '为租屋并暂时难以支付租金或水电费的家庭提供短期援助。',
    },
    keyConditions: [
      { en: 'Applicant is renting or staying in temporary housing.', zh: '申请者正在租屋或住在临时住处。' },
      { en: 'Monthly household income is RM3,500 or below.', zh: '每月家庭收入 RM3,500 或以下。' },
      { en: 'Needs rental agreement, utility bill, or arrears notice where available.', zh: '如有，需要租约、水电单或欠款通知。' },
    ],
    simpleExplanation: {
      en: 'This form is for households that need short-term help with rent, water, or electricity bills. It is usually checked together with proof of address and bills.',
      zh: '这份表格适合需要短期租金、水费或电费帮助的家庭。通常会一起检查住址证明和账单。',
    },
    legalNotes: [
      {
        en: 'Relief amount and duration depend on the programme and available budget.',
        zh: '援助金额与期限取决于相关计划和预算。',
      },
      {
        en: 'The desk may contact the landlord or utility provider if authorization is given.',
        zh: '若获得授权，柜台可能联系屋主或水电供应商核对资料。',
      },
    ],
    requiredFields: [
      ...baseFields,
      {
        id: 'rentalArrears',
        label: { en: 'Rental or utility issue', zh: '租金或水电问题' },
        question: {
          en: 'What payment do you need help with: rent, water, electricity, or all?',
          zh: '您需要哪方面帮助：租金、水费、电费，还是全部？',
        },
        section: 'financial',
        profileKey: 'rentalArrears',
        required: true,
      },
      documentField,
    ],
    consentItems: commonConsentItems,
    progressGuide: [
      { en: 'Open the housing assistance portal.', zh: '进入住房援助网站。' },
      { en: 'Tap the green "My Application" button at the top right.', zh: '点击右上角绿色「我的申请」按钮。' },
      { en: 'Enter IC number, postcode, and reference ID to check status.', zh: '输入身份证号码、邮编和申请编号查询进度。' },
    ],
  },
];

function t(language: AssistantLanguage, text: LocalizedText) {
  return text[language];
}

function toNumber(value?: string) {
  const match = value?.replace(/,/g, '').match(/\d+(\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function includesAny(value: string | undefined, terms: string[]) {
  const lower = (value ?? '').toLowerCase();
  return terms.some((term) => lower.includes(term.toLowerCase()));
}

function isYes(value?: string) {
  return includesAny(value, ['yes', 'y', 'true', 'disabled', 'disability', 'medical', 'mobility', '有', '是', '需要', '残', '醫', '医']);
}

function normalizeMaritalStatus(value?: string) {
  if (includesAny(value, ['widow', '丧', '喪'])) return 'widowed';
  if (includesAny(value, ['divorce', '离', '離'])) return 'divorced';
  if (includesAny(value, ['separate', '分居'])) return 'separated';
  if (includesAny(value, ['single', '单', '單', '未婚'])) return 'single';
  if (includesAny(value, ['married', '已婚', '结婚', '結婚'])) return 'married';
  return value?.trim().toLowerCase() || '';
}

function normalizeHousingStatus(value?: string) {
  if (includesAny(value, ['rent', 'rental', 'tenant', '租'])) return 'rent';
  if (includesAny(value, ['temporary', '临时', '臨時'])) return 'temporary';
  if (includesAny(value, ['family', '家人'])) return 'family';
  if (includesAny(value, ['own', 'owner', '自住'])) return 'own';
  return value?.trim().toLowerCase() || '';
}

function reason(language: AssistantLanguage, en: string, zh: string) {
  return language === 'zh' ? zh : en;
}

function evaluateForm(form: AssistanceForm, profile: ApplicantProfile, language: AssistantLanguage) {
  const age = toNumber(profile.age);
  const income = toNumber(profile.householdIncome);
  const children = toNumber(profile.children);
  const maritalStatus = normalizeMaritalStatus(profile.maritalStatus);
  const housingStatus = normalizeHousingStatus(profile.housingStatus);
  const matchedReasons: string[] = [];
  const missingInfo: string[] = [];
  const blockingReasons: string[] = [];
  let score = 0;

  function need(field: keyof ApplicantProfile, label: LocalizedText) {
    if (!profile[field]?.trim()) missingInfo.push(t(language, label));
  }

  function pass(en: string, zh: string, points = 1) {
    score += points;
    matchedReasons.push(reason(language, en, zh));
  }

  function block(en: string, zh: string) {
    blockingReasons.push(reason(language, en, zh));
  }

  switch (form.id) {
    case 'senior-living-support':
      if (age === null) need('age', { en: 'Age', zh: '年龄' });
      else if (age >= 60) pass('Age appears to meet the 60+ condition.', '年龄看起来符合 60 岁以上条件。', 2);
      else block('Age is below the usual 60+ condition.', '年龄低于通常的 60 岁以上条件。');

      if (income === null) need('householdIncome', { en: 'Monthly income', zh: '每月收入' });
      else if (income <= 3000) pass('Income appears within RM3,000.', '收入看起来在 RM3,000 以内。', 2);
      else block('Income is above RM3,000.', '收入高于 RM3,000。');
      break;

    case 'single-parent-family-aid':
      if (!maritalStatus) need('maritalStatus', { en: 'Marital status', zh: '婚姻状况' });
      else if (['single', 'widowed', 'divorced', 'separated'].includes(maritalStatus)) {
        pass('Family status may fit single-parent aid.', '家庭状况可能符合单亲援助。', 2);
      } else block('Marital status may not fit this single-parent programme.', '婚姻状况可能不符合这项单亲援助。');

      if (children === null) need('children', { en: 'Children / dependants', zh: '孩子 / 受扶养人数' });
      else if (children >= 1) pass('There is at least one child or dependant.', '至少有一位孩子或受扶养人。', 2);
      else block('No child or dependant was recorded.', '目前没有记录孩子或受扶养人。');

      if (income === null) need('householdIncome', { en: 'Monthly income', zh: '每月收入' });
      else if (income <= 4500) pass('Income appears within RM4,500.', '收入看起来在 RM4,500 以内。', 1);
      else block('Income is above RM4,500.', '收入高于 RM4,500。');
      break;

    case 'medical-mobility-grant':
      if (age === null && !profile.disability && !profile.medicalNeed) {
        missingInfo.push(reason(language, 'Age or medical need', '年龄或医疗需要'));
      } else if ((age ?? 0) >= 60 || isYes(profile.disability) || Boolean(profile.medicalNeed?.trim())) {
        pass('Age, disability, or medical need may fit this grant.', '年龄、残障或医疗需要可能符合这项津贴。', 2);
      } else block('No medical or mobility need is recorded yet.', '目前还没有记录医疗或行动需要。');

      if (income === null) need('householdIncome', { en: 'Monthly income', zh: '每月收入' });
      else if (income <= 5000) pass('Income appears within RM5,000.', '收入看起来在 RM5,000 以内。', 1);
      else block('Income is above RM5,000.', '收入高于 RM5,000。');
      break;

    case 'rental-utility-relief':
      if (!housingStatus) need('housingStatus', { en: 'Housing status', zh: '住房状况' });
      else if (['rent', 'temporary'].includes(housingStatus)) pass('Housing status may fit rental relief.', '住房状况可能符合租金援助。', 2);
      else block('Housing status is not renting or temporary housing.', '住房状况不是租屋或临时住处。');

      if (income === null) need('householdIncome', { en: 'Monthly income', zh: '每月收入' });
      else if (income <= 3500) pass('Income appears within RM3,500.', '收入看起来在 RM3,500 以内。', 1);
      else block('Income is above RM3,500.', '收入高于 RM3,500。');
      break;

    default:
      break;
  }

  const status: EligibilityStatus =
    blockingReasons.length === 0 && missingInfo.length === 0
      ? 'likely'
      : blockingReasons.length === 0 || score > blockingReasons.length
        ? 'needs-info'
        : 'not-likely';

  return {
    status,
    score,
    matchedReasons,
    missingInfo,
    blockingReasons,
  };
}

export function localizeForm(form: AssistanceForm, language: AssistantLanguage): LocalizedForm {
  return {
    id: form.id,
    title: t(language, form.title),
    agency: t(language, form.agency),
    category: t(language, form.category),
    updatedAt: form.updatedAt,
    description: t(language, form.description),
    keyConditions: form.keyConditions.map((item) => t(language, item)),
    simpleExplanation: t(language, form.simpleExplanation),
    legalNotes: form.legalNotes.map((item) => t(language, item)),
    requiredFields: form.requiredFields.map((field) => ({
      id: field.id,
      label: t(language, field.label),
      question: t(language, field.question),
      section: field.section,
      profileKey: field.profileKey,
      required: field.required,
      options: field.options?.map((option) => ({
        value: option.value,
        label: t(language, option.label),
      })),
    })),
    consentItems: form.consentItems.map((item) => t(language, item)),
    progressGuide: form.progressGuide.map((item) => t(language, item)),
  };
}

const situationKeywords: Record<string, string[]> = {
  'senior-living-support': [
    'senior',
    'elderly',
    'older',
    'old',
    'living',
    'daily',
    'food',
    'income',
    'money',
    'warga emas',
    '生活',
    '老人',
    '长者',
    '乐龄',
    '收入',
  ],
  'single-parent-family-aid': [
    'single parent',
    'single',
    'child',
    'children',
    'dependant',
    'guardian',
    'widow',
    'divorce',
    'family',
    '单亲',
    '孩子',
    '离婚',
    '抚养',
  ],
  'medical-mobility-grant': [
    'medical',
    'medicine',
    'hospital',
    'disability',
    'wheelchair',
    'mobility',
    'health',
    'doctor',
    '病',
    '医疗',
    '残障',
    '轮椅',
    '行动',
    '健康',
  ],
  'rental-utility-relief': [
    'rent',
    'rental',
    'utility',
    'water',
    'electric',
    'bill',
    'housing',
    'landlord',
    'house',
    'sewa',
    '租',
    '水电',
    '电费',
    '房租',
    '屋',
  ],
};

function normalizeSearchText(value: string) {
  return value.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
}

const situationStopWords = new Set([
  'need',
  'help',
  'and',
  'the',
  'for',
  'with',
  'pay',
  'paying',
  'apply',
  'application',
  'form',
  'want',
  'please',
  'saya',
  'perlukan',
  'bantuan',
]);

function situationScore(form: AssistanceForm, localizedForm: LocalizedForm, situation?: string) {
  const text = normalizeSearchText(situation ?? '');
  if (!text) return 0;

  const haystack = normalizeSearchText(
    [
      localizedForm.title,
      localizedForm.agency,
      localizedForm.category,
      localizedForm.description,
      localizedForm.simpleExplanation,
      ...localizedForm.keyConditions,
      ...localizedForm.legalNotes,
    ].join(' '),
  );
  const haystackTokens = new Set(haystack.split(' '));
  const tokens = Array.from(new Set(text.split(' ').filter((token) => token.length >= 3 && !situationStopWords.has(token))));
  const tokenScore = tokens.filter((token) => (/^[a-z0-9]+$/i.test(token) ? haystackTokens.has(token) : haystack.includes(token))).length;
  const keywordScore = (situationKeywords[form.id] ?? []).filter((keyword) => text.includes(keyword.toLowerCase())).length * 4;

  return tokenScore + keywordScore;
}

export function searchAssistanceForms(profile: ApplicantProfile, language: AssistantLanguage, situation?: string): SearchResult[] {
  const evaluated = assistanceForms
    .map((form) => {
      const localizedForm = localizeForm(form, language);
      return {
        form: localizedForm,
        situationScore: situationScore(form, localizedForm, situation),
        ...evaluateForm(form, profile, language),
      };
    })
    .sort((a, b) => {
      const statusRank: Record<EligibilityStatus, number> = {
        likely: 3,
        'needs-info': 2,
        'not-likely': 1,
      };
      return b.situationScore - a.situationScore || statusRank[b.status] - statusRank[a.status] || b.score - a.score;
    });

  if (situation?.trim()) {
    const situationMatches = evaluated.filter((item) => item.situationScore > 0 && item.status !== 'not-likely');
    return (situationMatches.length > 0 ? situationMatches : evaluated).slice(0, 3);
  }

  return evaluated.slice(0, 3);
}

export function getProfileFieldValue(profile: ApplicantProfile, field: Pick<ApplicationField, 'id' | 'profileKey'>) {
  if (field.profileKey) return profile[field.profileKey]?.trim() ?? '';
  if (field.id === 'fullAddress') {
    return [profile.addressLine, profile.taman, profile.postcode, profile.state].filter(Boolean).join(', ');
  }
  return '';
}

function buildReferenceId(formId: string, identityNumber: string) {
  const suffix = identityNumber.replace(/\D/g, '').slice(-4) || '0000';
  const prefix = formId
    .split('-')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 4);
  return `${prefix}-${suffix}-${new Date().getFullYear()}`;
}

function buildSmsPreview({
  language,
  name,
  formTitle,
  referenceId,
  progressGuide,
}: {
  language: AssistantLanguage;
  name: string;
  formTitle: string;
  referenceId: string;
  progressGuide: string[];
}) {
  const steps = progressGuide.map((step, index) => `${index + 1}. ${step}`).join(' ');
  if (language === 'zh') {
    return `${name || '您好'}，您的 ${formTitle} 申请草稿已完成。编号：${referenceId}。网站会安排已签署保密协议的志愿者进一步确认。查询进度：${steps}`;
  }
  return `Hi ${name || 'there'}, your ${formTitle} application draft is complete. Ref: ${referenceId}. A volunteer who has signed a confidentiality agreement will confirm the details. Progress check: ${steps}`;
}

export function buildApplicationPackage({
  formId,
  profile,
  extraAnswers,
  consents,
  language,
}: {
  formId: string;
  profile: ApplicantProfile;
  extraAnswers: Record<string, string>;
  consents: boolean[];
  language: AssistantLanguage;
}): ApplicationPackage {
  const form = assistanceForms.find((item) => item.id === formId) ?? assistanceForms[0];
  const localizedForm = localizeForm(form, language);
  const phone = profile.phone?.trim() || extraAnswers.phone || '-';
  const icNumber = profile.icNumber?.trim() || extraAnswers.icNumber || '-';
  const fields = localizedForm.requiredFields
    .map((field) => {
      const value = extraAnswers[field.id]?.trim() || getProfileFieldValue(profile, field);
      return {
        id: field.id,
        label: field.label,
        section: field.section,
        value,
        required: field.required,
      };
    })
    .sort((a, b) => sectionOrder.indexOf(a.section) - sectionOrder.indexOf(b.section));
  const missingFields = fields.filter((field) => field.required && !field.value).map((field) => field.label);
  const referenceId = buildReferenceId(form.id, icNumber);

  return {
    referenceId,
    form: localizedForm,
    applicantName: profile.name?.trim() || extraAnswers.name || '-',
    phone,
    icNumber,
    fields,
    missingFields,
    consents: localizedForm.consentItems.map((label, index) => ({
      label,
      accepted: Boolean(consents[index]),
    })),
    volunteer: {
      name: language === 'zh' ? '社区志愿者确认小组' : 'Community Volunteer Verification Team',
      confidentiality:
        language === 'zh'
          ? '志愿者在查看资料前必须签署个人资料保密与用途限制协议，只能为了这次申请确认资料，不能把资料用于其他用途。'
          : 'Volunteers must sign a personal-data confidentiality and limited-use agreement before reviewing details. They may only use the information to confirm this application.',
    },
    smsPreview: buildSmsPreview({
      language,
      name: profile.name?.trim() || extraAnswers.name || '',
      formTitle: localizedForm.title,
      referenceId,
      progressGuide: localizedForm.progressGuide,
    }),
  };
}
