FROM node:24-alpine
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY cucumber.mjs tsconfig.json ./
COPY features ./features
COPY support ./support
COPY step_definitions ./step_definitions

# Los reportes se escriben en /app/reports: móntelo como volumen o desaparecen con el contenedor.
VOLUME ["/app/reports"]

# npm test devuelve el código de salida de cucumber-js: distinto de cero si algún escenario falla.
CMD ["npm", "test"]
