import type { AppLanguage } from '@/components/LanguageProvider';
import type { AssistantLanguage } from '@/backend/elderly/forms';

export type Phase =
  | 'language'
  | 'collect'
  | 'confirmName'
  | 'confirmAddress'
  | 'addressFix'
  | 'greeting'
  | 'phone'
  | 'name'
  | 'nameConfirm'
  | 'nameCorrection'
  | 'profileCollect'
  | 'addressConfirm'
  | 'situation'
  | 'searching'
  | 'forms'
  | 'explain'
  | 'idCapture'
  | 'apply'
  | 'review'
  | 'reviewCorrection'
  | 'consent'
  | 'complete';

export type ProfileField =
  | 'icNumber'
  | 'age'
  | 'gender'
  | 'state'
  | 'postcode'
  | 'taman'
  | 'addressLine'
  | 'maritalStatus'
  | 'children'
  | 'householdIncome'
  | 'disability'
  | 'housingStatus';

export type LocalCopy = { en: string; zh: string; ms: string };

export const profileFieldOrder: ProfileField[] = [
  'icNumber',
  'age',
  'gender',
  'state',
  'postcode',
  'taman',
  'addressLine',
  'maritalStatus',
  'children',
  'householdIncome',
  'disability',
  'housingStatus',
];

export const addressFields: ProfileField[] = ['state', 'postcode', 'taman', 'addressLine'];

export const fieldLabels: Record<string, LocalCopy> = {
  phone: { en: 'Phone', zh: '电话号码', ms: 'Telefon' },
  englishName: { en: 'Full name', zh: '姓名', ms: 'Nama penuh' },
  icNumber: { en: 'IC number', zh: '身份证号码', ms: 'Nombor IC' },
  age: { en: 'Age', zh: '年龄', ms: 'Umur' },
  gender: { en: 'Gender', zh: '性别', ms: 'Jantina' },
  state: { en: 'State', zh: '州属', ms: 'Negeri' },
  postcode: { en: 'Postcode', zh: '邮编', ms: 'Poskod' },
  taman: { en: 'Taman / area', zh: '花园 / 地区', ms: 'Taman / kawasan' },
  addressLine: { en: 'Street address', zh: '门牌与街道', ms: 'Alamat jalan' },
  maritalStatus: { en: 'Marital status', zh: '婚姻状况', ms: 'Status perkahwinan' },
  children: { en: 'Children / dependants', zh: '孩子 / 受扶养人数', ms: 'Anak / tanggungan' },
  householdIncome: { en: 'Monthly household income', zh: '每月家庭收入', ms: 'Pendapatan isi rumah bulanan' },
  disability: { en: 'Disability or medical need', zh: '残障或医疗需要', ms: 'Keperluan perubatan' },
  housingStatus: { en: 'Housing status', zh: '住房状况', ms: 'Status perumahan' },
  situation: { en: 'Situation', zh: '情况描述', ms: 'Keadaan' },
};

export const fieldPrompts: Record<ProfileField, LocalCopy> = {
  icNumber: { en: 'What is your IC number?', zh: '请问您的身份证号码是什么？', ms: 'Apakah nombor IC anda?' },
  age: { en: 'How old are you this year?', zh: '请问您今年贵庚？', ms: 'Berapa umur anda tahun ini?' },
  gender: { en: 'What is your gender?', zh: '请问您的性别是什么？', ms: 'Apakah jantina anda?' },
  state: { en: 'Which state do you live in?', zh: '请问您住在哪一个州属？', ms: 'Anda tinggal di negeri mana?' },
  postcode: { en: 'What is your postcode?', zh: '您的邮编是多少？', ms: 'Apakah poskod anda?' },
  taman: { en: 'What is your taman or area?', zh: '您的花园或地区名称是什么？', ms: 'Apakah taman atau kawasan anda?' },
  addressLine: { en: 'Please say your house number and street.', zh: '请说出您的门牌号码和街道地址。', ms: 'Sila sebut nombor rumah dan jalan anda.' },
  maritalStatus: { en: 'What is your marital status?', zh: '请问您的婚姻状况是什么？', ms: 'Apakah status perkahwinan anda?' },
  children: { en: 'How many children or dependants are under your care?', zh: '您照顾的孩子或受扶养人有几位？', ms: 'Berapa anak atau tanggungan di bawah jagaan anda?' },
  householdIncome: { en: 'About how much is your monthly household income?', zh: '每月家庭总收入大概是多少？', ms: 'Berapakah anggaran pendapatan isi rumah bulanan?' },
  disability: { en: 'Do you have any disability or long-term medical need?', zh: '是否有残障或长期医疗需要？', ms: 'Ada keperluan perubatan jangka panjang?' },
  housingStatus: { en: 'Do you own, rent, or stay with family?', zh: '您是自住、租屋，还是和家人同住？', ms: 'Anda milik, sewa, atau tinggal dengan keluarga?' },
};

export const fieldOptions: Partial<Record<ProfileField, Array<{ label: LocalCopy; storedValue: string }>>> = {
  gender: [
    { label: { en: 'Male', zh: '男', ms: 'Lelaki' }, storedValue: 'Male' },
    { label: { en: 'Female', zh: '女', ms: 'Perempuan' }, storedValue: 'Female' },
  ],
  maritalStatus: [
    { label: { en: 'Single', zh: '单身', ms: 'Bujang' }, storedValue: 'single' },
    { label: { en: 'Married', zh: '已婚', ms: 'Berkahwin' }, storedValue: 'married' },
    { label: { en: 'Widowed', zh: '丧偶', ms: 'Balu / duda' }, storedValue: 'widowed' },
    { label: { en: 'Divorced', zh: '离婚', ms: 'Bercerai' }, storedValue: 'divorced' },
  ],
  disability: [
    { label: { en: 'Yes', zh: '有', ms: 'Ya' }, storedValue: 'yes' },
    { label: { en: 'No', zh: '没有', ms: 'Tidak' }, storedValue: 'no' },
  ],
  housingStatus: [
    { label: { en: 'Rent', zh: '租屋', ms: 'Sewa' }, storedValue: 'rent' },
    { label: { en: 'Own home', zh: '自住房屋', ms: 'Rumah sendiri' }, storedValue: 'own' },
    { label: { en: 'Stay with family', zh: '和家人同住', ms: 'Tinggal dengan keluarga' }, storedValue: 'family' },
    { label: { en: 'Temporary housing', zh: '临时住所', ms: 'Tempat sementara' }, storedValue: 'temporary' },
  ],
};

export const CONSENT_ITEMS: Record<AppLanguage, string[]> = {
  en: [
    'I agree that this application draft can be prepared for review before any official submission.',
    'I authorize relevant parties to verify my household, eligibility, and supporting information where required.',
    'I agree that the information provided are accurate and legitimate. The information will be reviewed by members of the Malaysian Translator Association working as translation executive within the government sector.',
  ],
  zh: [
    '我同意网站先为我准备申请草稿，正式提交前还需要进一步确认。',
    '我授权相关单位在需要时核对我的家庭、资格与证明资料。',
    '我同意所提供的资料准确且真实。资料将由马来西亚翻译协会在政府部门担任翻译执行员的成员审核。',
  ],
  ms: [
    'Saya bersetuju draf permohonan ini disediakan untuk semakan sebelum sebarang penghantaran rasmi.',
    'Saya membenarkan pihak berkaitan menyemak maklumat isi rumah, kelayakan dan dokumen sokongan jika diperlukan.',
    'Saya bersetuju maklumat yang diberikan adalah tepat dan sah. Maklumat akan disemak oleh ahli Persatuan Penterjemah Malaysia yang bertugas sebagai eksekutif terjemahan dalam sektor kerajaan.',
  ],
};

export const copy = {
  welcome: {
    en: 'Hello, welcome to this government-authorised website. I am Xiao Shuai, and I will guide you step by step.',
    zh: '您好，欢迎来到政府授权的网站。我叫小帅，会一步一步帮您完成。',
    ms: 'Helo, selamat datang ke laman web yang diberi kuasa kerajaan. Saya Xiao Shuai dan akan membimbing anda langkah demi langkah.',
  } satisfies LocalCopy,
  welcomeSecond: {
    en: 'You can answer by voice or typing. If anything looks wrong, tell me and we will correct it.',
    zh: '您可以用语音或文字回答。如果识别错了，请告诉我，我们会一起更正。',
    ms: 'Anda boleh jawab dengan suara atau menaip. Jika ada yang salah, beritahu saya dan kita betulkan.',
  } satisfies LocalCopy,
  askPhone: {
    en: 'First, what phone number should the volunteer use to contact you after this flow?',
    zh: '首先，请问之后志愿者应该用哪个电话号码联系您？',
    ms: 'Pertama, nombor telefon mana yang boleh digunakan sukarelawan untuk menghubungi anda selepas aliran ini?',
  } satisfies LocalCopy,
  askName: {
    en: 'Please say your full name.',
    zh: '请说出您的姓名。',
    ms: 'Sila sebut nama penuh anda.',
  } satisfies LocalCopy,
  nameConfirm: {
    en: 'I heard your name as {value}. Is this correct?',
    zh: '我听到您的姓名是：{value}。请问正确吗？',
    ms: 'Saya dengar nama anda sebagai {value}. Betul?',
  } satisfies LocalCopy,
  spellName: {
    en: 'Please spell the correct name one letter at a time.',
    zh: '请一个字母一个字母把正确姓名拼出来。',
    ms: 'Sila eja nama yang betul satu huruf demi satu huruf.',
  } satisfies LocalCopy,
  addressConfirm: {
    en: 'Your address is {value}. Is this correct?',
    zh: '您的地址是：{value}。请问正确吗？',
    ms: 'Alamat anda ialah {value}. Betul?',
  } satisfies LocalCopy,
  addressRetry: {
    en: 'No problem. I will ask the address again, part by part.',
    zh: '没关系，我会把地址分成几个部分再问一次。',
    ms: 'Tidak mengapa. Saya akan tanya alamat semula mengikut bahagian.',
  } satisfies LocalCopy,
  situationAsk: {
    en: 'Please describe your situation in your own words so I can find suitable forms.',
    zh: '请用自己的话描述您的情况，我会帮您找合适的表格。',
    ms: 'Sila terangkan keadaan anda supaya saya boleh mencari borang yang sesuai.',
  } satisfies LocalCopy,
  searching: {
    en: 'Thank you. I am using AI-assisted screening to compare your basic details with the forms in our storage.',
    zh: '谢谢您。我会用 AI 辅助筛选，把您的基本资料和资料库里的表格做比较。',
    ms: 'Terima kasih. Saya menggunakan saringan bantuan AI untuk membandingkan maklumat asas anda dengan borang dalam storan kami.',
  } satisfies LocalCopy,
  noForms: {
    en: 'No suitable forms were found in our storage right now.',
    zh: '目前我们的资料库里没有找到合适的表格。',
    ms: 'Tiada borang yang sesuai dijumpai dalam storan kami buat masa ini.',
  } satisfies LocalCopy,
  foundForms: {
    en: 'I found {count} recommended form types. AI used: Google Gemini 3 Flash Preview, with rule checks for eligibility. You can say the number or tap one.',
    zh: '我筛选出 {count} 种推荐表格。使用的 AI：Google Gemini 3 Flash Preview，并配合资格规则检查。您可以说号码或点击选择。',
    ms: 'Saya jumpa {count} jenis borang cadangan. AI digunakan: Google Gemini 3 Flash Preview, bersama semakan peraturan kelayakan. Anda boleh sebut nombor atau tekan pilihan.',
  } satisfies LocalCopy,
  continueForm: {
    en: 'Would you like to continue with this form?',
    zh: '您要继续申请这份表格吗？',
    ms: 'Adakah anda mahu teruskan dengan borang ini?',
  } satisfies LocalCopy,
  idCaptureIntro: {
    en: 'Now please photograph the front and back of your ID. The system will automatically turn both photos into one PDF page named ID-<YourName>.',
    zh: '现在请拍摄身份证的正面和背面。系统会自动把两张照片变成一页 PDF，文件名是 ID-<您的姓名>。',
    ms: 'Sekarang sila ambil gambar hadapan dan belakang IC anda. Sistem akan menukar kedua-dua gambar kepada satu halaman PDF bernama ID-<NamaAnda>.',
  } satisfies LocalCopy,
  reviewReady: {
    en: 'The draft is ready. Please check whether the details are correct.',
    zh: '申请草稿准备好了。请检查资料是否正确。',
    ms: 'Draf sudah sedia. Sila semak sama ada maklumat betul.',
  } satisfies LocalCopy,
  correctionAsk: {
    en: 'Please tell me which detail is wrong and the correct value.',
    zh: '请告诉我哪一个资料错了，以及正确内容。',
    ms: 'Sila beritahu maklumat mana yang salah dan nilai yang betul.',
  } satisfies LocalCopy,
  consentAsk: {
    en: 'Please review the simple version and the important full terms before we complete the flow.',
    zh: '完成前，请先看简单版说明，再阅读并同意下面的重点完整条款。',
    ms: 'Sila semak versi ringkas dan syarat penting yang lengkap sebelum selesai.',
  } satisfies LocalCopy,
  complete: {
    en: 'All done. The website will arrange a volunteer to confirm the details before any official submission. The volunteer must sign a personal-data confidentiality and limited-use agreement, and may only use your information for this application.',
    zh: '已经完成了。网站会安排志愿者进一步确认资料，之后才会正式提交。志愿者必须签署个人资料保密与用途限制协议，只能为了这次申请使用您的资料。',
    ms: 'Selesai. Laman web akan mengatur sukarelawan untuk mengesahkan maklumat sebelum penghantaran rasmi. Sukarelawan mesti menandatangani perjanjian kerahsiaan data peribadi dan penggunaan terhad.',
  } satisfies LocalCopy,
  smsSent: {
    en: 'I also prepared an SMS with your reference number and progress-check steps.',
    zh: '我也准备了短信，里面有申请编号和查询进度的步骤。',
    ms: 'Saya juga menyediakan SMS dengan nombor rujukan dan langkah semakan status.',
  } satisfies LocalCopy,
  tapMic: {
    en: 'Tap once to start speaking, and tap again to stop.',
    zh: '点击一次开始说话，再点击一次停止。',
    ms: 'Tekan sekali untuk bercakap, tekan sekali lagi untuk berhenti.',
  } satisfies LocalCopy,
  micOn: { en: 'Recording on', zh: '已开启', ms: 'Rakaman dihidupkan' } satisfies LocalCopy,
  micOff: { en: 'Tap to speak', zh: '点击说话', ms: 'Tekan untuk bercakap' } satisfies LocalCopy,
  yes: { en: 'Correct / Yes', zh: '正确 / 是', ms: 'Betul / Ya' } satisfies LocalCopy,
  no: { en: 'Wrong / No', zh: '错误 / 不是', ms: 'Salah / Tidak' } satisfies LocalCopy,
};

export function apiLanguage(language: AppLanguage): AssistantLanguage {
  return language === 'zh' ? 'zh' : 'en';
}

export function voiceCode(language: AppLanguage) {
  if (language === 'zh') return 'zh-CN';
  if (language === 'ms') return 'ms-MY';
  return 'en-US';
}

export function t(language: AppLanguage, item: LocalCopy) {
  return item[language];
}

export function fill(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce((current, [key, value]) => current.replace(`{${key}}`, String(value)), template);
}
