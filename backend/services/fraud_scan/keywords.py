from __future__ import annotations

_SCAM_KEYWORDS: list[str] = [
    # English — capital-market products
    "investment", "crypto investment", "forex signal", "share investment", "AI trading", "robot trading", "trading bot",
    "crypto mining scheme", "Binary Options", "not SC licensed",
    "unregistered platform", "offshore trading", "outside SC Jurisdiction",

    # English — guaranteed-return hooks
    "high returns", "guaranteed profit", "guaranteed returns",
    "no risk investment", "risk-free investment", "passive income",
    "financial freedom", "fast profit", "quick profit", "double your money",
    "guaranteed high fixed returns", "risk free trading", "sure profit",

    # English — pressure / urgency
    "limited slots", "limited seats", "act fast",
    "exclusive group", "VIP signal", "VIP group",
    "WhatsApp group", "Telegram group", "PM me", "DM me",
    "pressure to invest immediately", "limited time offer", "last chance",

    # English — social proof / fees / impersonation
    "proof of withdrawal", "withdrawal proof", "testimonial",
    "profit screenshot", "SC Malaysia", "Securities Commission",
    "licensed by SC", "approved by SC", "BNM approved",
    "Shariah compliant investment", "activation fee", "registration fee",
    "upgrade fee", "agent account", "deepfake regulatory logo",
    "AI-generated ad", "fake endorsement", "celebrity investment",
    "fake testimonial", "account access request", "SC impersonation",

    # English — romance scams
    "I want to marry you", "I need money urgent", "I am in trouble",
    "help me I promise pay back", "I love you", "I'm coming to Malaysia soon",
    "send money for visa", "send money for flight ticket", "family emergency",

    # English — job scams
    "work from home", "easy money", "registration fee required",
    "no experience needed", "guaranteed salary", "data entry job",
    "online survey", "pay before getting job", "processing fee",

    # English — parcel/delivery scams
    "package at customs", "pay tax for parcel", "delivery fee required",
    "package held at KLIA", "clearance fee", "international parcel",

    # English — impersonation
    "I'm from LHDN", "I'm from bank", "suspicious transaction",
    "verify your identity", "account will be frozen", "court case",
    "police want to talk to you", "your account is hacked",

    # English — banking
    "Transfer to my account number", "I need your ATM pin number",
    "Give me your online banking password", "Send me your TAC number now",
    "CIMB account please bank in now", "Send to Hong Leong account", "Give me your CVV number",

    # Bahasa Malaysia — products
    "pelaburan", "saham", "forex", "kripto", "dana amanah", "unit amanah",
    "isyarat saham", "isyarat forex", "dagangan AI", "robot dagangan",
    "pakej pelaburan", "modal kecil", "Opsyen Binari", "tidak berlesen SC",
    "platform tidak berdaftar", "dagangan luar pesisir", "di luar bidang kuasa SC",
    "entiti klon", "entiti tidak berdaftar", "senarai amaran pengguna kewangan",
    "senarai amaran pelabur", "pulangan bulanan 30%", "masalah pengeluaran",

    # BM — hooks
    "pulangan tinggi", "pulangan cepat", "jamin untung", "dijamin untung",
    "tanpa risiko", "bebas risiko", "pendapatan pasif", "kebebasan kewangan",
    "buat duit cepat", "untung cepat", "gandakan wang", "profit cepat",
    "pulangan tetap tinggi", "dagangan tanpa risiko", "pasti untung",

    # BM — pressure
    "slot terhad", "tempat terhad", "cepat masuk", "sertai sekarang",
    "kumpulan eksklusif", "signal VIP", "kumpulan VIP",
    "kumpulan WhatsApp", "kumpulan Telegram", "PM tepi", "inbox saya",
    "tekanan untuk melabur segera", "tawaran masa terhad", "peluang terakhir",

    # BM — social proof / fees
    "bukti withdraw", "bukti keuntungan", "testimoni",
    "tangkapan skrin untung", "Suruhanjaya Sekuriti", "diluluskan SC",
    "patuh syariah", "diiktiraf BNM", "yuran pengaktifan",
    "yuran pendaftaran", "akaun wakil", "yuran naik taraf",
    "video deepfake", "iklan dijana ai", "endorsement palsu",
    "pelaburan selebriti", "testimoni palsu", "permintaan akses akaun",
    "penyamaran SC",

    # BM — romance scams
    "saya nak kahwin dengan awak", "saya perlukan wang segera", "saya ada masalah",
    "tolong saya janji bayar balik", "saya cinta padamu", "saya akan datang Malaysia",
    "hantar duit untuk visa", "hantar duit untuk tiket kapal", "kecemasan keluarga",

    # BM — job scams
    "kerja dari rumah", "duit senang", "yuran pendaftaran diperlukan",
    "tiada pengalaman diperlukan", "gaji dijamin", "kerja kemasukan data",
    "tinjauan dalam talian", "bayar sebelum dapat kerja", "yuran pemprosesan",

    # BM — parcel/delivery scams
    "bungkusan di kastam", "bayar cukai untuk bungkusan", "yuran penghantaran diperlukan",
    "bungkusan tertahan di KLIA", "yuran pelepasan", "bungkusan antarabangsa",

    # BM — impersonation
    "saya dari LHDN", "saya dari bank", "transaksi mencurigakan",
    "sahkan identiti anda", "akaun akan dibekukan", "kes mahkamah",
    "polis nak bercakap dengan anda", "akaun anda digodam",

    # Manglish — investment
    "confirm profit one", "sure can kaya", "easy money lah", "no risk one",
    "sure untung", "can make money fast", "can get rich fast",
    "trust me lah", "legit one", "real deal lah", "pm me lah",
    "whatsapp me", "join my group lah", "telegram group", "add me lah",
    "last few slots lah", "closing soon lah", "don't miss out",
    "fast fast join", "crypto lah", "trade together", "my sifu",
    "sifu signal", "investment group", "rm per month guaranteed",
    "confirm boleh untung", "tak yah kerja lagi", "dua minggu jadi kaya",
    "duit masuk tak henti", "duit segera", "buat duit senang",
    "projek duit", "duit otomatik", "projek jadi kaya", "duit free",
    "no pain no gain", "ini bukan penipuan", "bukan skim cepat kaya",
    "modal kecil untung besar", "tak yah jual barang", "tak yah cari orang",
    "skim dah lulus", "dapat duit cash", "gerenti dapat payment",
    "sistem auto withdraw", "follow my habib", "private group",
    "inside info", "ramai dh dapat duit", "halal investment",
    "power broker", "SC verified", "SC approve", "BNM license",

    # Manglish — romance scams
    "I want to marry you lah", "Sayang, I miss you", "Love you forever my dear",
    "My darling, need money urgent", "Honey, I in trouble now",
    "Help me sayang, I promise pay back", "I coming Malaysia soon to meet you",

    # Manglish — urgency and pressure
    "Last chance sia", "Better act now boleh?", "Don't wait, will regret later",
    "This offer ending today", "If you don't join now, lose out",
    "Limited time only maaa", "Before too late better decide",
    "Last few units only lah", "Closing soon, hurry up sayang",

    # Manglish — code-switching terms
    "You got money, I got method", "This one confirm can make untung",
    "My friend, this project power one", "I guarantee you, tak kena tipu",
    "You trust me, I trust you", "This one halal or not halal?",
    "Boss, this project legit one", "My cousin in gomen also doing this",
    "My uncle at bank say this is good", "My sister at police station say it's safe",

    # Manglish — job and employment scams
    "No experience needed lah, just need follow instruction", "I recruit for job, you just need pay registration fee", "This job guaranteed RM5000 per month",
    "Like and share to get paid", "Simple survey, get RM50 each", "Just click ads, computer will earn money for you",

    # Manglish — parcel/delivery scams
    "Your parcel at customs need pay tax", "I from PosLaju, you need pay delivery fee leh",
    "Your package from overseas stuck at KLIA", "You need to pay clearance fee",
    "Gift from UK for you but tax needed",

    # Manglish — government impersonation
    "I from LHDN, you ada tax problem", "I from court, you kena case",
    "Polis nak talk to you about crime", "Akaun bank u akan frozen if you don't pay",
    "You involved in money laundering", "IC u guna untuk crime",

    # Manglish — general scam phrases
    "This one not scam, I guarantee", "I not liar, trust me",
    "My father is Dato', so this is legit", "If you don't believe, can meet me in person",
    "I already show you my IC", "I can show you my bank statement",
    "This one got permit one", "I will sign agreement with you",
    "I already pay tax", "My lawyer will draft agreement",
    "See my Instagram, I'm real person", "This one correct one, not fake",
    "Don't worry, my grandma also in this",

    # Chinese (Malaysian context) - Simplified Chinese
    "投资", "加密货币", "加密币", "韩国币", "比特币", "以太币",
    "股票信号", "外汇信号", "交易机器人", "AI交易", "犯罪",
    "基金", "数字货币", "数字钱包", "高回报", "保证盈利", "盈利保证",
    "稳定收益", "无风险", "零风险", "无本生意", "快速致富",
    "被动收入", "财务自由", "理财规划", "限时优惠", "名额有限",
    "加入群组", "私信私我", "私聊我", "独家群", "VIP信号", "顶级内幕",
    "会员群", "专业猎人", "交易群", "提款证明", "提款截图",
    "盈利截图", "用户见证", "证监会", "马来西亚证监会",
    "马来西亚金融执照", "马来西亚银监", "国行批准", "获批准",
    "伊斯兰合规", "清真投资", "激活费", "注册费", "代理账户",
    "克隆实体", "未授权实体", "金融消费者警示名单", "投资者警示名单",
    "30%月回报", "月息3%", "提现问题", "账户访问请求", "SC冒充",
    "高息项目", "保本付息", "本金担保", "投资骗局", "庞氏骗局",
    "稳赚不赔", "躺着赚钱", "被动收入来源", "月息分红", "日息分红",
    "高额补贴", "原始股认购", "股指交易", "数字货币钱包", "挖矿机",
    "货币对冲", "国际平台", "境外投资", "马来西亚多看", "马来西亚持牌",
    "马来西亚监管", "马来西亚央行", "马来西亚账户", "马币交易", "赚钱快",
    "改命机会", "人生转折", "贵人相助", "新加坡平台", "越级平台",

    # Chinese — romance scams
    "我要娶你", "我紧急需要钱", "我遇到麻烦了",
    "帮我说啊朋友，我保证还钱", "我爱你", "我很快会来马来西亚",
    "为我的签证寄钱", "为我的机票寄钱", "家里人出事了",

    # Chinese — job scams
    "在家工作", "轻松赚钱", "需要注册费",
    "不需要经验", "保证工资", "数据输入工作",
    "网上调查", "在工作前先付款", "处理费",

    # Chinese — parcel/delivery scams
    "包裹在海关", "为包裹付税", "需要送货费",
    "包裹在KLIA滞留", "清关费", "国际包裹",

    # Chinese — impersonation
    "我来自LHDN", "我来自银行", "可疑交易",
    "验证你的身份", "你的账户将被冻结", "法庭案件",
    "警察想和你谈谈犯罪的事", "你的账户被黑了",
]

_KEYWORDS_LOWER: list[tuple[str, str]] = [
    (kw.lower(), kw) for kw in _SCAM_KEYWORDS
]


def match_keywords(text: str) -> list[str]:
    text_lower = text.lower()
    return [original for lower, original in _KEYWORDS_LOWER if lower in text_lower]
