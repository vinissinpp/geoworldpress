# Geo World Press: plano de arquitetura e processos (colocar no ar)

Hoje o projeto roda só no seu PC. Este plano mostra como levá-lo para a internet, de forma gratuita e com o mínimo de manutenção, e como organizar o trabalho do dia a dia.

---

## 1. Visão geral

Separar o projeto em duas partes, com uma ponte entre elas:

```
 SEU PC (gera as notícias)                    INTERNET (mostra o site)
 ─────────────────────────                    ────────────────────────
 Tarefa do Windows, a cada 2 h                Hospedagem estática
        │                                     (GitHub Pages ou Cloudflare Pages)
        ▼                                            ▲
 atualizar.js                                        │ publica sozinha
   coleta RSS → Claude (Haiku) → valida              │ a cada push
        │                                            │
        ▼                                            │
 data/news.json ──► git commit + git push ───────────┘
```

- **O site** (`index.html`, `data/*.json`) é estático: não tem servidor, banco de dados nem login. Qualquer visitante lê os mesmos arquivos.
- **A geração das notícias** continua no seu PC, usando o login do Claude que já funciona.
- **A ponte** é o Git: cada atualização vira um commit, e a hospedagem republica sozinha.

### Por que não rodar tudo na nuvem agora
Dá para fazer (GitHub Actions com a API do Claude), mas aí o consumo passa a ser **cobrado por uso via API**, não pela cota da assinatura. Fica como evolução futura (seção 8), quando houver receita ou quando o PC deixar de ser confiável.

---

## 2. Hospedagem

| Opção | Custo | Prós | Contras |
|---|---|---|---|
| **GitHub Pages** ⭐ | grátis | simples, já integra com o Git, HTTPS, URL `usuario.github.io/geo-world-press` | repositório precisa ser público (código e dados ficam visíveis) |
| Cloudflare Pages | grátis | rápido no mundo todo, painel de métricas, aceita repositório privado | um passo a mais para configurar |
| Netlify | grátis (limite mensal) | deploy por arrastar pasta | menos integrado ao Git |
| VPS (servidor próprio) | R$ 20–40/mês | controle total | manutenção, segurança e backup por sua conta (não recomendo agora) |

**Recomendação:** GitHub Pages no começo. Se quiser o site num domínio próprio (ex.: `geoworldpress.com`), dá para apontar o domínio para qualquer uma dessas opções depois.

### Domínio
- Um domínio `.com` custa cerca de **R$ 40–70 por ano**. Sem domínio, a URL é `usuario.github.io/...`, que funciona bem para começar.
- **Antes de comprar, verificar:**
  - se o domínio está livre;
  - se o nome **"Geo World Press"** já não é marca registrada parecida (INPI, no Brasil, e USPTO, nos EUA). É uma checagem de 5 minutos e evita retrabalho depois.

---

## 3. Mudanças técnicas necessárias

| Item | O que fazer | Por quê |
|---|---|---|
| Repositório Git | `git init` na pasta do projeto, com `.gitignore` | versionar código e publicar |
| `.gitignore` | ignorar `data/state/` (log, lock, histórico de links) e `scripts/*.log` | esses arquivos são só do seu PC |
| Caminhos relativos | já estão relativos (`data/news.json`), então funcionam em subpasta do GitHub Pages | nada a mudar |
| Remover o servidor local da publicação | `servidor.js` continua útil só para testes; o site online não precisa dele | — |
| Commit + push no `atualizar.js` | depois de gravar `news.json`, rodar `git add data/news.json`, `git commit` e `git push` | publicação automática |
| Aviso de "dados desatualizados" | se `atualizado` tiver mais de 6 h, mostrar um aviso no site | o PC pode estar desligado; o visitante precisa saber |
| Página "Sobre" e metodologia | texto curto: o que é, de onde vêm as notícias, como são escolhidas, aviso sobre resumos por IA | transparência e segurança jurídica (seção 5) |
| Metadados para compartilhar | título, descrição e imagem de capa (Open Graph) | o link aparece bonito no WhatsApp, X e LinkedIn |
| Idioma | seletor já feito (PT/EN/ES) para a interface | — |

---

## 4. Processos do dia a dia

### 4.1 Atualização automática (a cada 2 h)
1. A tarefa do Windows roda `atualizar-oculto.vbs`.
2. `atualizar.js` coleta RSS, pede ao Claude (Haiku 5.5) e valida o resultado.
3. Se **nada mudou**, não há commit: nada a publicar.
4. Se mudou: `data/news.json` é commitado com a mensagem `news: atualização AAAA-MM-DD HH:MM` e enviado (`push`).
5. A hospedagem republica em 1–2 min.
6. O resultado de cada rodada (ok, erro, custo) fica no `log.txt`.

### 4.2 Mudanças de código (quando eu ajustar o site)
- Commit com mensagem clara, separada dos commits de notícias: `feat: seletor de idioma`, `fix: balão some ao sair do país`.
- Antes de publicar, testar no navegador local (`abrir-tabuleiro.cmd`).
- Publicar = `git push`. Desfazer = `git revert` do commit problemático.

### 4.3 Revisão semanal (30 min, 1 vez por semana)
- [ ] Conferir o `log.txt`: falhas, feeds com erro, custo da semana.
- [ ] Conferir os **lances do dia** e os países com 3 notícias: algo errado?
- [ ] Ver se algum portal saiu do ar ou mudou o endereço do RSS (aparece em "Feeds com erro").
- [ ] Conferir se o site abre no celular.

### 4.4 Correção de notícia errada (incidente)
| Gravidade | Exemplo | O que fazer | Prazo |
|---|---|---|---|
| Alta | fato falso, nome errado de político, notícia perigosa | remover pela lista de bloqueio (seção 6) e publicar | até 2 h (na próxima rodada) |
| Média | resumo impreciso, categoria errada | corrigir o `prompt.md` ou o item no `news.json` | na revisão semanal |
| Baixa | país com ponto no lugar errado | ajustar a coordenada em `capitais.json` ou `paises.geojson` | quando der |

### 4.5 Queda de feed ou do PC
- **Feed fora do ar:** o script só registra "Feeds com erro" e segue com os demais. Não precisa agir, a não ser que o portal fique fora por semanas.
- **PC desligado:** o site continua no ar mostrando a última atualização, com o aviso de "desatualizado" depois de 6 h.
- **Cota do Claude esgotada:** a rodada falha com erro de limite no log. Espera renovar; a próxima tenta de novo.

---

## 5. Pontos legais e de confiança (antes de divulgar)

1. **Termos dos portais:** o RSS é público, mas os termos de uso de alguns portais (Reuters e AP, por exemplo) restringem o uso comercial de conteúdo. O site hoje faz resumo próprio + link para a fonte, o que é o formato mais seguro. **Se for monetizar, rever esse ponto com calma.**
2. **Resumos por IA:** colocar um aviso visível no site ("resumos gerados com IA a partir das manchetes; confira na fonte original").
3. **Termos do Claude:** o script roda com a sua assinatura Pro, em tarefa agendada. Vale conferir nos termos da Anthropic se esse uso automatizado é permitido no seu plano. Se não for, o caminho é a chave de API (seção 8).
4. **Privacidade:** o site não usa cookies nem coleta dados de visitantes. Se um dia usar um analytics, escolher um sem cookies e informar na página "Sobre".
5. **Atribuição:** sempre mostrar o nome do portal e o link original em cada notícia (já é assim).

---

## 6. Controle editorial (lista de bloqueio)

Para evitar que a mesma notícia volte depois de removida:

- Arquivo `scripts/bloqueio.json` com links e palavras a ignorar.
- O `atualizar.js` descarta essas manchetes antes de chamar o Claude.
- Vantagem: a correção vale para todas as rodadas futuras, sem depender do Claude "lembrar".

---

## 7. Decisões que preciso de você

1. **Hospedagem:** GitHub Pages (recomendado) ou Cloudflare Pages?
2. **Repositório público ou privado?** Com GitHub Pages gratuito, o repositório precisa ser público. Se preferir privado, o caminho é o Cloudflare Pages.
3. **Domínio próprio:** quer comprar agora, ou começar pela URL do GitHub?
4. **Idioma das notícias:** hoje o conteúdo é em português. Quer que o Claude também escreva em inglês e espanhol? Isso aumenta um pouco o consumo da cota, mas o site fica acessível para quem não lê português.
5. **Nome:** "Geo World Press" serve, ou quer ajustar após a checagem de marca?

---

## 8. Evolução futura

| Quando | O que muda |
|---|---|
| Se o PC deixar de ser confiável, ou a cota não der conta | mover a geração para **GitHub Actions** com chave de API (custo por uso, previsível) |
| Quando quiser mais alcance | Open Graph por notícia, página por país, RSS próprio do Geo World Press |
| Quando houver mais volume | cache do lado do Claude, histórico de 7 dias (slider no globo) |
| Ideias já listadas | arcos entre países, calendário de eleições, selo de origem da fonte |

---

## 9. Roteiro sugerido

| Fase | Entrega | Quando |
|---|---|---|
| **0** | Nome "Geo World Press" e seletor de idioma na interface | ✅ feito hoje |
| **1** | Git local, `.gitignore`, primeiro commit | próximo passo |
| **2** | Publicação no GitHub Pages + push automático na atualização | depois da decisão da seção 7 |
| **3** | Aviso de desatualizado, página "Sobre", metadados de compartilhamento | antes de divulgar |
| **4** | Lista de bloqueio, revisão semanal rotineira | depois de publicar |
| **5** | Notícias em EN/ES (se decidir), melhorias do globo | quando a base estiver estável |

A fase 1 não depende de nenhuma decisão, então dá para começar já.
