# OpenAI Legal Assistant for Uzbekistan

## Overview

This project aims to provide a legal assistant chatbot powered by OpenAI's RWST API tailored for the legal sphere of Uzbekistan. The bot utilizes OpenAI's powerful language model to provide legal consultations and assistance to users based on Uzbekistan's legal framework.

## Features

- **OpenAI RWST API Integration**: Utilizes OpenAI's RWST (Retrieve, Wait, Select, Transform) API for generating responses based on user input.
- **Dataset Files**: Contains datasets relevant to Uzbekistan's legal system, curated for training and enhancing the chatbot's capabilities.
- **Telegram Bot Server**: Includes a server for hosting a Telegram bot, enabling users to interact with the legal assistant directly within the Telegram messaging platform.

## Local Acts Dataset

- The Labor Code of the Republic of Uzbekistan (from 28.10.2022)

## Contributors
- [Adham Mamedov](https://github.com/Adham-Mamedov)

## Telegram Bot Setup
- Create a new bot using the [BotFather](https://t.me/botfather) and obtain `TELEGRAM_BOT_TOKEN`. See [Tutorial](https://core.telegram.org/bots#how-do-i-create-a-bot)

## OpenAI API Setup
- Create an account on OpenAI and obtain the API key. See [Tutorial](https://platform.openai.com/docs/quickstart?context=node)
- Create Assistant and obtain the Assistant ID. See [Tutorial](https://platform.openai.com/docs/assistants/overview/step-1-create-an-assistant)

## MongoDB Setup
- Create a MongoDB database and obtain the connection string. See [Tutorial](https://www.mongodb.com/docs/guides/atlas/connection-string/)

## Project Setup
- Install the required packages using `yarn install`
- Create a `.env` file in the root directory and add environment variables from `.env.example`
- Uncomment `// createExpirationIndex('threads'); // createExpirationIndex('limits');` in `src/services/prisma.service.ts` to create TTL indexes
- You can comment out the above lines after running the server once
- Run the dev server using `yarn dev`
- The server will be running on `http://localhost:3000`


### TODO:
- [ ] Add more legal datasets
- [ ] Use summaries of legal documents for better responses
- [ ] Add caching for FAQ
- [ ] Enable in group chat
- [ ] Add donations button and increase limit for tpd for those users
- [ ] Add Ads for law firms
- [ ] Save Bot info to DB
