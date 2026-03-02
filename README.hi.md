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

मल्टी-रजिस्ट्री पैकेज प्रकाशन के लिए वांछित स्थिति सिंक इंजन। यह आपके GitHub संगठन का npmjs और GHCR के खिलाफ विश्लेषण करता है, संस्करण विचलन का पता लगाता है, अनाथ पैकेजों को ढूंढता है, और कार्रवाई योजनाएं उत्पन्न करता है - जैसे कि पैकेज रजिस्ट्रियों के लिए Terraform।

`registry-stats` ([https://github.com/mcp-tool-shop-org/registry-stats](https://github.com/mcp-tool-shop-org/registry-stats)) के लिए पूरक उपकरण।

## इंस्टॉलेशन

```bash
npm install -g @mcptoolshop/registry-sync
```

या सीधे उपयोग करें:

```bash
npx @mcptoolshop/registry-sync audit --org my-org
```

## शुरुआत

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

यह GitHub संगठन में सभी रिपॉजिटरी को स्कैन करता है, प्रत्येक रिपॉजिटरी की `package.json` फ़ाइल को पढ़ता है और `Dockerfile` की जांच करता है, और फिर npmjs और GHCR से जानकारी प्राप्त करके एक उपस्थिति मैट्रिक्स बनाता है।

```
registry-sync audit [--org <org>] [--format table|json|markdown]
```

आउटपुट प्रत्येक रजिस्ट्री के लिए स्थिति दिखाता है:
- **✓** current — प्रकाशित संस्करण रिपॉजिटरी के संस्करण से मेल खाता है
- **⚠** behind — रिपॉजिटरी का संस्करण प्रकाशित संस्करण से आगे है
- **missing** — अभी तक प्रकाशित नहीं किया गया है
- **○** orphan — प्रकाशित है लेकिन कोई मेल खाने वाला रिपॉजिटरी नहीं है

### `plan`

यह एक ऑडिट चलाता है और जोखिम स्तरों के साथ एक कार्रवाई योजना उत्पन्न करता है।

```
registry-sync plan [--org <org>] [--target npmjs|ghcr|all]
```

कार्रवाई के प्रकार:
- **publish** — किसी रजिस्ट्री पर पहली बार प्रकाशन
- **update** — संस्करण को अपडेट करने की आवश्यकता है (रिपॉजिटरी प्रकाशित संस्करण से आगे है)
- **scaffold-workflow** — PR के माध्यम से CI प्रकाशन वर्कफ़्लो जोड़ें
- **prune** — अनाथ पैकेज को साफ़ करने की आवश्यकता है

### `apply`

यह योजना को निष्पादित करता है। v1 में सभी क्रियाएं गैर-विनाशकारी हैं:
- प्रकाशन/अपडेट/साफ़ करने की क्रियाओं के लिए GitHub **इश्यू** बनाता है
- scaffold क्रियाओं के लिए CI वर्कफ़्लो फ़ाइलों के साथ GitHub **PR** खोलता है

```
registry-sync apply --confirm [--target npmjs|ghcr|all]
```

`--confirm` के बिना, यह एक ड्राई-रन दिखाता है (जो `plan` के समान है)।

## कॉन्फ़िगरेशन

अपने प्रोजेक्ट के रूट में `registry-sync.config.json` फ़ाइल रखें:

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

यदि कोई कॉन्फ़िगरेशन फ़ाइल नहीं मिलती है, तो यह डिफ़ॉल्ट सेटिंग्स का उपयोग करता है।

## प्रमाणीकरण

इसके लिए `repo` स्कोप के साथ एक GitHub टोकन की आवश्यकता होती है:

1. `GITHUB_TOKEN` पर्यावरण चर (पसंदीदा)
2. `gh auth token` (यदि GitHub CLI स्थापित है)

v1 में npm टोकन की आवश्यकता नहीं है (केवल-पढ़ने योग्य रजिस्ट्री क्वेरी)।

## लाइब्रेरी का उपयोग

```typescript
import { audit, plan, loadConfig } from '@mcptoolshop/registry-sync';

const config = loadConfig();
const auditResult = await audit(config);
const planResult = plan(auditResult, config);

console.log(planResult.summary);
// { publish: 9, update: 1, scaffold: 26, prune: 3, skip: 45 }
```

## सुरक्षा और खतरे का मॉडल

पूर्ण सुरक्षा मॉडल के लिए [SECURITY.md](./SECURITY.md) देखें।

**यह किन चीज़ों को प्रभावित करता है:** सार्वजनिक GitHub API (रिपॉजिटरी मेटाडेटा, फ़ाइल सामग्री, इश्यू, PR) और सार्वजनिक npm रजिस्ट्री (केवल-पढ़ने योग्य पैकेज मेटाडेटा)। जब `apply --confirm` का उपयोग किया जाता है तो यह उन रिपॉजिटरी पर इश्यू और PR बनाता है जिनके लिए आपके पास लिखने की अनुमति है।

**यह किन चीज़ों को प्रभावित नहीं करता है:** कोई भी स्थानीय फ़ाइल संशोधित नहीं की जाती है (केवल-पढ़ने योग्य कॉन्फ़िगरेशन लुकअप)। कोई npm प्रकाशन नहीं, कोई Docker पुश नहीं, कोई क्रेडेंशियल स्टोरेज नहीं। कोई भी डेटा आपके मशीन से GitHub/npm API कॉल के अलावा बाहर नहीं जाता है।

**आवश्यक अनुमतियाँ:** `repo` स्कोप के साथ GitHub टोकन (ऑडिट के लिए पढ़ने की अनुमति, लागू करने के लिए लिखने की अनुमति)। किसी भी npm टोकन की आवश्यकता नहीं है।

**कोई टेलीमेट्री नहीं।** कोई विश्लेषण नहीं। कोई "होम" कॉल नहीं। किसी भी प्रकार का डेटा संग्रह नहीं।

---

<a href="https://mcp-tool-shop.github.io/">MCP Tool Shop</a> द्वारा निर्मित।
