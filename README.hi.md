<p align="center">
  <a href="README.ja.md">日本語</a> | <a href="README.zh.md">中文</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.md">English</a> | <a href="README.it.md">Italiano</a> | <a href="README.pt-BR.md">Português (BR)</a>
</p>

<p align="center">
  <a href="https://mcp-tool-shop-org.github.io/registry-sync/">
    <img src="https://raw.githubusercontent.com/mcp-tool-shop-org/brand/main/logos/registry-sync/readme.png" width="400" alt="registry-sync" />
  </a>
</p>

<p align="center">
  <a href="https://github.com/mcp-tool-shop-org/registry-sync/actions/workflows/ci.yml"><img src="https://github.com/mcp-tool-shop-org/registry-sync/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://www.npmjs.com/package/@mcptoolshop/registry-sync"><img src="https://img.shields.io/npm/v/@mcptoolshop/registry-sync" alt="npm" /></a>
  <a href="https://github.com/mcp-tool-shop-org/registry-sync/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT License" /></a>
  <a href="https://mcp-tool-shop-org.github.io/registry-sync/"><img src="https://img.shields.io/badge/Landing_Page-live-blue" alt="Landing Page" /></a>
</p>

बहु-रजिस्ट्री पैकेज प्रकाशन के लिए वांछित-अवस्था सिंक्रनाइज़ेशन इंजन। यह आपके GitHub संगठन का npmjs और GHCR के विरुद्ध ऑडिट करता है, संस्करण में बदलाव का पता लगाता है, अनाथ पैकेजों को ढूंढता है, और कार्रवाई योजनाओं को उत्पन्न करता है — जैसे पैकेज रजिस्ट्रियों के लिए टेराफॉर्म।

[`registry-stats`](https://github.com/mcp-tool-shop-org/registry-stats) के लिए राइट-साइड सहायक।

## इंस्टॉल करें

```bash
npm install -g @mcptoolshop/registry-sync
```

या सीधे उपयोग करें:

```bash
npx @mcptoolshop/registry-sync audit --org my-org
```

## त्वरित शुरुआत

```bash
# Set your GitHub token
export GITHUB_TOKEN=ghp_...

# Audit your org — see what's published, what's drifted, what's missing
registry-sync audit --org mcp-tool-shop-org

# Generate an action plan
registry-sync plan --org mcp-tool-shop-org

# Execute the plan (creates GitHub issues + PRs)
registry-sync apply --confirm
```

## कमांड

### `audit`

किसी GitHub संगठन में सभी रिपॉजिटरी को स्कैन करता है, प्रत्येक रिपॉजिटरी के `package.json` को पढ़ता है और `Dockerfile` के लिए जांच करता है, फिर एक उपस्थिति मैट्रिक्स बनाने के लिए npmjs और GHCR से क्वेरी करता है।

```
registry-sync audit [--org <org>] [--format table|json|markdown]
```

आउटपुट प्रति रजिस्ट्री विचलन स्थिति दिखाता है:
- **✓** वर्तमान — प्रकाशित संस्करण रिपॉजिटरी से मेल खाता है
- **⚠** पीछे — रिपॉजिटरी संस्करण प्रकाशित संस्करण से आगे है
- **↓** आगे — प्रकाशित संस्करण रिपॉजिटरी से आगे है (रोलबैक या हॉटफ़िक्स)
- **गायब** — अभी तक प्रकाशित नहीं
- **○** अनाथ — प्रकाशित लेकिन कोई मिलान करने वाला रिपॉजिटरी नहीं

### `plan`

एक ऑडिट चलाता है और जोखिम स्तरों के साथ एक कार्रवाई योजना उत्पन्न करता है।

```
registry-sync plan [--org <org>] [--target npmjs|ghcr|all]
```

कार्रवाई के प्रकार:
- **प्रकाशित करें** — किसी रजिस्ट्री में पहली बार प्रकाशित करें
- **अपडेट करें** — संस्करण अपडेट की आवश्यकता है (रिपॉजिटरी प्रकाशित से आगे है)
- **स्केफोल्ड-वर्कफ़्लो** — पीआर के माध्यम से सीआई प्रकाशन वर्कफ़्लो जोड़ें
- **छंटाई करें** — अनाथ पैकेज को साफ करने की आवश्यकता है

### `diff`

दो ऑडिट स्नैपशॉट की तुलना करता है ताकि यह पता लगाया जा सके कि रन के बीच क्या बदला — नया विचलन, हल किया गया विचलन, बढ़ा हुआ विचलन, नए/हटाए गए रिपॉजिटरी और अनाथ परिवर्तन।

```
registry-sync diff --before audit-old.json --from audit-new.json [--format table|json|markdown]
```

इसके लिए पहले से सहेजे गए दो ऑडिट JSON फ़ाइलों की आवश्यकता होती है (`registry-sync audit --json -o <file>` से)। कोई नई एपीआई कॉल नहीं की जाती है — अंतर दो स्नैपशॉट पर शुद्ध गणना है।

परिवर्तन के प्रकार:
- **नया_विचलन** — रिपॉजिटरी वर्तमान था, अब पीछे/गायब/आगे है
- **हल किया गया** — विचलन मौजूद था, अब वर्तमान है
- **बढ़ा हुआ** — विचलन गहरा हो गया (जैसे पीछे → गायब)
- **नया_रिपॉजिटरी** / **हटाया_गया_रिपॉजिटरी** — स्नैपशॉट के बीच रिपॉजिटरी जोड़ा या हटाया गया

### `apply`

योजना को निष्पादित करता है। v1 में सभी कार्रवाई गैर-विनाशकारी हैं:
- प्रकाशित/अपडेट/छंटाई कार्यों के लिए GitHub **मुद्दे** बनाता है
- स्केफोल्ड कार्यों के लिए सीआई वर्कफ़्लो फ़ाइलों के साथ GitHub **पीआर** खोलता है

```
registry-sync apply --confirm [--target npmjs|ghcr|all]
```

`--confirm` के बिना, एक ड्राई-रन दिखाता है (`plan` के समान)।

## कॉन्फ़िगरेशन

`registry-sync.config.json` को अपने प्रोजेक्ट रूट में रखें:

```json
{
  "org": "mcp-tool-shop-org",
  "exclude": [".github", "brand"],
  "targets": {
    "npm": { "enabled": true },
    "ghcr": { "enabled": true }
  }
}
```

यदि कोई कॉन्फ़िगरेशन फ़ाइल नहीं मिलती है तो यह उचित डिफ़ॉल्ट पर वापस आ जाता है।

## प्रमाणीकरण

इसके लिए `repo` स्कोप के साथ GitHub टोकन की आवश्यकता होती है:

1. `GITHUB_TOKEN` पर्यावरण चर (पसंदीदा)
2. `gh auth token` फ़ॉलबैक (यदि GitHub सीएलआई स्थापित है)

v1 में npm टोकन की आवश्यकता नहीं है (केवल-पढ़ने योग्य रजिस्ट्री क्वेरी)।

## लाइब्रेरी उपयोग

```typescript
import { audit, plan, diff, loadConfig } from '@mcptoolshop/registry-sync';

const config = loadConfig();
const auditResult = await audit(config);
const planResult = plan(auditResult, config);

console.log(planResult.summary);
// { publish: 9, update: 1, scaffold: 26, prune: 3, skip: 45 }

// Compare two snapshots
const oldAudit = JSON.parse(readFileSync('audit-old.json', 'utf-8'));
const diffResult = diff(oldAudit, auditResult);
console.log(diffResult.summary);
// { newDrift: 2, resolved: 1, worsened: 0, unchanged: 40, ... }
```

## सुरक्षा और खतरे का मॉडल

संपूर्ण सुरक्षा मॉडल के लिए [SECURITY.md](./SECURITY.md) देखें।

**यह क्या छूता है:** सार्वजनिक GitHub एपीआई (रिपॉजिटरी मेटाडेटा, फ़ाइल सामग्री, मुद्दे, पीआर) और सार्वजनिक npm रजिस्ट्री (केवल-पढ़ने योग्य पैकेज मेटाडेटा)। जब `apply --confirm` का उपयोग किया जाता है तो उन रिपॉजिटरी पर मुद्दे और पीआर बनाता है जिन तक आपके पास लिखने की पहुंच है।

**यह क्या नहीं छूता है:** कोई भी स्थानीय फ़ाइल संशोधित नहीं की जाती है (केवल-पढ़ने योग्य कॉन्फ़िगरेशन लुकअप)। कोई npm प्रकाशित नहीं, कोई डॉकर पुश नहीं, कोई क्रेडेंशियल स्टोरेज नहीं। GitHub/npm एपीआई कॉल से परे कोई भी डेटा आपके मशीन से बाहर नहीं जाता है।

**आवश्यक अनुमतियाँ:** `repo` स्कोप के साथ GitHub टोकन (ऑडिट के लिए पढ़ें, लागू करने के लिए लिखें)। npm टोकन की आवश्यकता नहीं है।

**कोई टेलीमेट्री नहीं।** कोई एनालिटिक्स नहीं। कोई होम-टू-फ़ोन नहीं। किसी भी प्रकार का कोई डेटा संग्रह नहीं।

---

<a href="https://mcp-tool-shop.github.io/">MCP टूल शॉप</a> द्वारा निर्मित।
