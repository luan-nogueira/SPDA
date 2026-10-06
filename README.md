# ⚡ Sistema de Inspeção de Postes & SPDA

Aplicativo web progressivo (PWA) e mobile-first projetado para vistoria técnica de postes, cabeamento de câmeras e sistemas de proteção contra descargas atmosféricas (SPDA).

## 🚀 Principais Funcionalidades

- **📋 Checklist Técnico Completo**: Inspeção estruturada de estado físico, infraestrutura, cabos, caixas de equipamentos e aterramento vinculado ao SPDA.
- **📍 Geolocalização & Mapa de Satélite**: Captura de coordenadas GPS com múltiplos fallbacks (Wi-Fi, rede, GPS alta precisão e IP) integrado com mapa de satélite Leaflet com ajuste fino de pinos.
- **🗺️ Mapa Geral dos Postes**: Visualização de todos os postes georreferenciados no terminal, identificando pontos com e sem não conformidades.
- **📏 Controle de Metragem de Cabos**: Registro das distâncias estimadas de cabo até a câmera e até o subsistema de SPDA.
- **📷 Registro Fotográfico**: Captura de fotos com compressão local automática no navegador para economia de dados e velocidade em campo.
- **📴 Modo Offline & Sincronização**: Suporte a operação sem internet em campo com persistência em cache local e upload em segundo plano quando a conexão for restabelecida.
- **📊 Painel Executivo**: Dashboard com métricas em tempo real de postes concluídos, não conformidades e somatório de cabos.
- **📄 Exportação de Relatórios**:
  - **CSV**: Exportação detalhada para planilhas (Excel/Google Sheets).
  - **PDF Técnico**: Relatório executivo completo em formato para impressão/PDF A4 com tabelas, observações, galeria de fotos e campos para assinatura técnica.

## 🛠️ Tecnologias Utilizadas

- **React 19** + **Vite**
- **Firebase Firestore** (com `persistentLocalCache` ativado)
- **Firebase Authentication & Storage**
- **Leaflet & Esri Satellite Imagery**
- **CSS3 Vanilla** (Design System com Dark Glassmorphism e otimizações de impressão)

## 💻 Como Rodar o Projeto

```bash
# Instalar dependências
npm install

# Iniciar servidor de desenvolvimento
npm run dev

# Gerar build de produção
npm run build
```
