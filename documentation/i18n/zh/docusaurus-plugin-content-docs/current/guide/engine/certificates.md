---
sidebar_position: 5
---

# 证书

OIBus 维护一个证书库(**引擎 > 证书**),用于向外部系统验证 OIBus 的身份。其中一种场景是使用指定证书通过 **Azure Active
Directory with certificates** 建立 [OIAnalytics](../north-connectors/oianalytics.md) 连接。

证书条目可以由 **OIBus 生成**(自签名),也可以从外部证书颁发机构**导入**。

## 生成自签名证书 {#generating-a-self-signed-certificate}

使用 **+** 按钮并填写主题字段(通用名称、国家、省/州、地区、组织)、密钥长度以及到期前的天数。OIBus 会生成一个 RSA 密钥对,
自行签署证书,并将私钥加密存储。

显示的到期时间是证书本身的实际 `notAfter` 日期。

## 导入由您自己的 CA 签署的证书 {#importing-a-certificate-signed-by-your-own-ca}

使用**上传**按钮导入现有证书,而不是生成新证书。您必须提供:

- **证书文件**(必填)— 叶证书,PEM(`.pem`、`.crt`、`.cer`)或 DER(`.der`、`.cer`)编码。
- **私钥文件**(必填)— 匹配的私钥,PKCS#1(`-----BEGIN RSA PRIVATE KEY-----`)或 PKCS#8
  (`-----BEGIN PRIVATE KEY-----`),PEM 或 DER 编码。支持加密密钥 — 在**私钥口令**字段中提供口令。
- **CA 证书链文件**(可选)— 中间及根 CA 证书。由于一个 DER 文件只能容纳一个证书,多证书链必须以拼接后的 PEM 包形式提供。

OIBus 会验证私钥是否与证书的公钥匹配,否则将拒绝导入。到期时间从证书本身读取。仅支持 RSA 密钥。

CA 证书链将按提供的原样存储;OIBus 不会验证它是否实际链接到叶证书。

:::info
不支持 PKCS#12 / `.pfx` 包。请先提取证书和密钥:

```bash
openssl pkcs12 -in bundle.pfx -clcerts -nokeys -out certificate.pem
openssl pkcs12 -in bundle.pfx -nocerts -nodes -out private-key.pem
```
:::

## 下载证书 {#downloading-a-certificate}

证书行上的**下载**按钮会打开一个对话框,提供以下选项:

- **格式** — **PEM**(`.pem`)或 **DER**(`.cer`)。DER 是 Kepware 等 OPC UA 服务器所期望的格式,因此可以直接使用,
  无需通过 `openssl` 进行转换。
- **包含 CA 证书链** — 将存储的证书链附加到导出的文件中。仅在选择 PEM 时可用,因为一个 DER 文件只能容纳一个证书。
- **包含私钥** — 见下文。

## 下载私钥 {#downloading-the-private-key}

私钥只能以加密形式下载。勾选**包含私钥**并输入口令(至少 8 个字符,需重复输入以确认)。OIBus 会生成一个 PKCS#8
加密的 PEM 文件(`-----BEGIN ENCRYPTED PRIVATE KEY-----`,采用 PBES2、PBKDF2-HMAC-SHA256 和 AES-256-CBC),
作为与证书分开的单独文件一起下载。

OIBus 从不存储该口令 — 如果您丢失了口令,下载的文件将无法使用。每次私钥导出都会与请求者一起记录在 OIBus 日志中。

您可以使用以下命令检查或转换下载的密钥:

```bash
openssl pkcs8 -in private-key.pem -passin pass:yourpassphrase -noout
```
