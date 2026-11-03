# Publishing Colored Markdown

The publisher is set to `cina-dev`. One placeholder is left to replace before you publish:

| Placeholder | Where | Replace with |
|---|---|---|
| `YOUR_GITHUB_USERNAME` | `package.json` → `repository`, `bugs`, `homepage` | Your GitHub user or organization name |

## 1. Put the code on GitHub

1. Create an empty repository named `colored-markdown` on <https://github.com/new> (no README, no license; they are already here).
2. In this folder run:

   ```bash
   git remote add origin https://github.com/YOUR_GITHUB_USERNAME/colored-markdown.git
   git push -u origin main
   ```

3. The **CI** workflow runs automatically: lint, unit tests and integration tests inside real VS Code on Linux, Windows and macOS, then builds the `.vsix` as a downloadable artifact.

## 2. Create a Marketplace publisher and token (one time)

1. Sign in to <https://marketplace.visualstudio.com/manage> with a Microsoft account and click **Create publisher**. Use the ID `cina-dev` (already set in `package.json`).
2. Create a Personal Access Token in Azure DevOps (<https://dev.azure.com> → *User settings* → *Personal access tokens* → *New Token*):
   - Organization: **All accessible organizations**
   - Scopes: *Custom defined* → **Marketplace → Manage**
   - Copy the token; it is only shown once.

## 3a. Publish from your computer

```bash
npm install
npx vsce login cina-dev   # paste the token
npm test
npx vsce publish                   # or: npx vsce publish minor  (bumps the version too)
```

Or upload the file by hand: run `npx vsce package`, then on <https://marketplace.visualstudio.com/manage> choose your publisher → **New extension → Visual Studio Code** and upload `colored-markdown-1.0.0.vsix`.

## 3b. Publish automatically from GitHub (recommended)

1. On GitHub, open the repository → **Settings → Secrets and variables → Actions → New repository secret**.
   - Name: `VSCE_PAT`, value: the Azure DevOps token.
   - Optional: `OVSX_PAT` with a token from <https://open-vsx.org> to also publish to Open VSX (used by VSCodium, Cursor, Gitpod).
2. Release a version:

   ```bash
   npm version patch        # 1.0.0 -> 1.0.1, updates package.json and creates tag v1.0.1
   git push --follow-tags
   ```

   For the very first release, without bumping, run `git tag v1.0.0 && git push origin v1.0.0`.

3. The **Release** workflow runs all tests, checks that the tag matches `package.json`, creates a GitHub Release with the `.vsix` attached, and publishes to the Marketplace (and Open VSX if that secret exists).

Remember to add an entry to `CHANGELOG.md` for each release.

## Install the .vsix without the Marketplace

```bash
code --install-extension colored-markdown-1.0.0.vsix
```

Or in VS Code: Extensions view → `…` menu → **Install from VSIX…**
