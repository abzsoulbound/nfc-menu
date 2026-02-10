# NFC POS System

Core rules:
- User session = person
- NFC tag = physical access point
- Table = staff-controlled grouping

Architecture:
- App Router with server APIs under app/api/*
- Domain logic in lib/*
- Stateless UI with client stores in store/*

Routes:
- /menu public menu
- /t/[tagId] customer ordering
- /staff operational control
- /kitchen kitchen station
- /bar bar station

Development:
- npm install
- copy .env.example to .env.local
- prisma migrate dev
- npm run dev
