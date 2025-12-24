<img src="./public/icon/128.png" style="width:80px;">

# IPFS Publisher

[中文文档](./README.zh-CN.md) / [English](./README.md)

A simple browser extension to publish Markdown articles to IPFS network.

[Chrome Web Store](https://chromewebstore.google.com/detail/boadlmdjnofefcpehbdjjmbggghejiga)

[Github](https://github.com/anghunk/IPFS-Publisher)

![](./public/2.png)
![](./public/1.png)

## Features

- Write Markdown content and publish to IPFS with one click
- Automatically convert to styled HTML pages
- Manage published article list
- Custom IPFS gateway and local node API address support
- Real-time Markdown preview
- Multi-language support (Chinese/English), follows browser language by default
- Create keys using IPNS, bind to unique URL

## Usage

1. Install [IPFS Desktop](https://docs.ipfs.tech/install/ipfs-desktop/)
2. Load the extension
3. Write and publish articles in the popup or options page

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Package for release
npm run zip
```

## Tech Stack

- Vue 3 + TypeScript
- Element Plus
- WXT (Browser Extension Framework)
- vue-i18n (Internationalization)

## License

[Apache-2.0 license](./LICENSE)
