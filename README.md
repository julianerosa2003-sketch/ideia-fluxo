# Ideia Fluxo (PWA)

PWA para guardar ideias de projetos em cards e gerar um prompt pronto a partir delas.

## Rodar

```bash
npm start          # http://localhost:3000  (Node >= 18, zero dependências)
```

Docker / Coolify:

```bash
docker build -t ideias-pwa . && docker run -p 3000:3000 ideias-pwa
```

> O service worker (instalação/offline) só funciona em `localhost` ou HTTPS.

## Publicar no GitHub Pages

Settings → Pages → Source: *Deploy from a branch* → Branch `main`, pasta `/docs`.
Depois adicione `SEU-USUARIO.github.io` em Firebase → Authentication → Configurações → Domínios autorizados.

## Estrutura

```
server.js                 servidor estático (sem deps, bloqueia path traversal)
firestore.rules           regras de segurança do Firestore
docs/
  index.html              layout + modais (<dialog>)
  app.js                  CRUD, render, prompt, backup, conta
  cloud.js                login Google + Firestore
  firebase-config.js      config pública do Firebase
  vendor/firebase/        SDK do Firebase
  styles.css
  sw.js                   cache offline (suba CACHE ao alterar arquivos)
  manifest.webmanifest
  icons/
```

## Dados

- **Sem login:** ficam no `localStorage` do navegador (chave `ideias:v1`). Exporte backup em Ajustes.
- **Com login Google:** ficam no Firestore em `users/{uid}/ideas/{id}`, sincronizam entre aparelhos
  e funcionam offline. No primeiro login, as ideias locais são enviadas para a conta.

### Firebase

- Config pública em `docs/firebase-config.js` (não é segredo).
- Segurança em `firestore.rules`: cole no Console → Firestore → Regras → Publicar.
- SDK servido localmente em `docs/vendor/firebase` (v13.2.0, sem CDN). Para atualizar:
  `npm i firebase@X` em pasta temporária, copie `firebase-{app,auth,firestore}.js` e troque o
  import `https://www.gstatic.com/firebasejs/X/firebase-app.js` por `./firebase-app.js`.
- Ao publicar em outro domínio: Console → Authentication → Configurações → Domínios autorizados.

## Template do prompt

Editável em `buildPrompt()` no `app.js`.
