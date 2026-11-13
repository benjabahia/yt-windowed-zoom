# YouTube Windowed Zoom

Extensão do Chrome (Manifest V3) para assistir YouTube em tela dividida.

## Funções
1. **Tela cheia na janela**: o botão de tela cheia (ou `F`, ou duplo clique) faz o vídeo preencher só a janela do Chrome, não o monitor.
   - `Esc` sai.
   - `Shift` + tela cheia = tela cheia real (monitor inteiro).
2. **Zoom com scroll**: com o mouse sobre o vídeo, a rodinha amplia/reduz, centrado no cursor (1× a 8×, configurável).
3. **Pan**: com zoom aplicado, clique e arraste para mover o enquadramento. Clique do meio volta ao 1×.

## Instalar
1. Descompacte a pasta.
2. Abra `chrome://extensions`.
3. Ative o **Modo do desenvolvedor** (canto superior direito).
4. Clique em **Carregar sem compactação** e selecione a pasta `yt-windowed-zoom`.
5. Recarregue as abas do YouTube que já estavam abertas.

## Configurações
Clique no ícone da extensão: ligar/desligar cada função, zoom só em tela cheia ou sempre, velocidade e zoom máximo.

## Como funciona (resumo técnico)
- `src/main-world.js` roda no contexto da página e substitui `requestFullscreen` / `exitFullscreen` / `document.fullscreenElement`. O YouTube "acha" que está em tela cheia e muda de layout, mas o CSS só faz o elemento ocupar `100vw × 100vh` com `position: fixed`.
- `src/content.js` aplica `transform: translate() scale()` no `<video>` (os controles não são ampliados) e cuida do scroll e do arraste.
- `src/content.css` tem os estilos.

## Se algo quebrar
O YouTube muda o HTML de vez em quando. Os seletores usados ficam em `src/content.js` (`.html5-video-player`, `video.html5-main-video`, lista `EXCLUDED`).
