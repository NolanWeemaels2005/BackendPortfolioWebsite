# Portfolio Backend

Backend voor een Vite + React + TypeScript portfolio website. De API gebruikt Node.js, Express, MongoDB met Mongoose, JWT authentication, bcryptjs, multer en Cloudinary.

## Installatie

```bash
cd portfolio-backend
npm install
```

## Environment variables

Maak een `.env` bestand op basis van `.env.example`:

```env
PORT=5001
MONGO_URI=mongodb+srv://USERNAME:PASSWORD@cluster.mongodb.net/portfolio
JWT_SECRET=replace-with-long-random-secret
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=replace-with-strong-password
CLOUDINARY_CLOUD_NAME=replace
CLOUDINARY_API_KEY=replace
CLOUDINARY_API_SECRET=replace
FRONTEND_URL=http://localhost:5173
```

Gebruik voor `JWT_SECRET` een lange willekeurige string.

## Lokaal starten

```bash
npm run dev
```

De API draait standaard op:

```txt
http://localhost:5001
```

## Admin seeden

Seed de eerste admin gebruiker eenmalig:

```bash
curl -X POST http://localhost:5001/api/auth/seed-admin
```

De route maakt alleen een gebruiker aan als er nog geen users bestaan.

## Login testen

```bash
curl -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"replace-with-strong-password"}'
```

De response bevat een JWT token. Gebruik die token in protected routes:

```txt
Authorization: Bearer JOUW_TOKEN
```

## Project toevoegen testen

De `POST /api/projects` route verwacht `multipart/form-data`:

- `title`
- `text`
- `heroImage`: exact 1 bestand
- `images`: exact 3 bestanden
- `clientLogoSvg`: optioneel, maximaal 1 SVG bestand

Voorbeeld:

```bash
curl -X POST http://localhost:5001/api/projects \
  -H "Authorization: Bearer JOUW_TOKEN" \
  -F "title=Mijn project" \
  -F "text=Beschrijving van mijn project" \
  -F "heroImage=@/pad/naar/hero.jpg" \
  -F "clientLogoSvg=@/pad/naar/client-logo.svg" \
  -F "images=@/pad/naar/image-1.jpg" \
  -F "images=@/pad/naar/image-2.jpg" \
  -F "images=@/pad/naar/image-3.jpg"
```

Zet bij FormData in de frontend geen `Content-Type: application/json`. Laat de browser zelf de multipart boundary zetten.

## Publieke project routes

```txt
GET /api/projects
GET /api/projects/:slug
```

## Protected project routes

```txt
POST /api/projects
DELETE /api/projects/:id
```

## MongoDB Atlas setup

1. Maak een MongoDB Atlas account.
2. Maak een cluster.
3. Maak een database user aan met wachtwoord.
4. Voeg je IP toe aan Network Access, of gebruik voor Render tijdelijk `0.0.0.0/0`.
5. Kopieer de connection string naar `MONGO_URI`.
6. Vervang username, password en database naam.

## Cloudinary setup

1. Maak een Cloudinary account.
2. Ga naar Dashboard.
3. Kopieer `Cloud name`, `API key` en `API secret`.
4. Zet deze waarden in `.env`.

Afbeeldingen en optionele SVG logo's worden naar Cloudinary geupload. MongoDB bewaart alleen de Cloudinary `secure_url`.

## Render deploy

1. Zet backend op GitHub.
2. Maak op Render een nieuwe Web Service.
3. Connect GitHub repository.
4. Runtime: Node.
5. Build command: `npm install`.
6. Start command: `npm start`.
7. Voeg environment variables toe:
   - `MONGO_URI`
   - `JWT_SECRET`
   - `ADMIN_EMAIL`
   - `ADMIN_PASSWORD`
   - `CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`
   - `FRONTEND_URL`
8. Deploy.
9. Gebruik de Render backend URL in de frontend:

```env
VITE_API_URL=https://jouw-backend.onrender.com/api
```

## Frontend koppeling

### Frontend `.env`

```env
VITE_API_URL=http://localhost:5001/api
```

### Login fetch

```ts
const login = async (email: string, password: string) => {
  const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email, password })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Login mislukt.");
  }

  localStorage.setItem("token", data.token);
  return data;
};
```

### Projecten ophalen

```ts
const getProjects = async () => {
  const response = await fetch(`${import.meta.env.VITE_API_URL}/projects`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Projecten ophalen mislukt.");
  }

  return data;
};
```

### Een project ophalen via slug

```ts
const getProjectBySlug = async (slug: string) => {
  const response = await fetch(`${import.meta.env.VITE_API_URL}/projects/${slug}`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Project ophalen mislukt.");
  }

  return data;
};
```

### Project toevoegen met FormData

```ts
type AddProjectInput = {
  title: string;
  text: string;
  heroImage: File;
  images: File[];
  clientLogoSvg?: File;
};

const addProject = async ({
  title,
  text,
  heroImage,
  images,
  clientLogoSvg
}: AddProjectInput) => {
  const token = localStorage.getItem("token");

  if (!token) {
    throw new Error("Je bent niet ingelogd.");
  }

  if (images.length !== 3) {
    throw new Error("Selecteer exact 3 afbeeldingen.");
  }

  const formData = new FormData();
  formData.append("title", title);
  formData.append("text", text);
  formData.append("heroImage", heroImage);
  if (clientLogoSvg) {
    formData.append("clientLogoSvg", clientLogoSvg);
  }
  images.forEach((image) => formData.append("images", image));

  const response = await fetch(`${import.meta.env.VITE_API_URL}/projects`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: formData
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Project toevoegen mislukt.");
  }

  return data.project;
};
```

### Protected admin route voorbeeld

```tsx
import { Navigate, Outlet } from "react-router-dom";

const ProtectedAdminRoute = () => {
  const token = localStorage.getItem("token");

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};

export default ProtectedAdminRoute;
```

Gebruik bijvoorbeeld:

```tsx
<Route element={<ProtectedAdminRoute />}>
  <Route path="/admin/projects/new" element={<NewProjectPage />} />
</Route>
```

## Blog gebruiken

Open `/blog/` op de backend-URL. Deze pagina bevat een publiek overzicht, volledige berichten en **Blog beheren**. Log in met je bestaande admin-account. Voeg een link naar deze URL toe aan de navigatie van je portfolio; deze repository bevat de backend en geen bestaande React-frontend.

Maak een bericht, bewaar het als concept, upload media en publiceer het wanneer het klaar is. Concepten zijn alleen via de beveiligde beheerroutes beschikbaar. Publicatie vereist titel, samenvatting, context, proces, leerinzicht, reflectie, bronnen en minstens één voor- en één na-afbeelding. Planning is optioneel. Bij AI-gebruik zijn de AI-bijdrage en eigen bijdrage verplicht. De aanbevolen schrijflengte wordt in het formulier toegelicht; er is geen automatische beoordeling van de inhoud.

Foto’s en video’s hebben geen vaste aantallimiet per bericht. Uploads worden afzonderlijk verwerkt via tijdelijke schijfopslag, zodat een grote selectie niet volledig in servergeheugen wordt geladen. Per bestand geldt 100 MB; Cloudinary-abonnement, providerlimieten en servercapaciteit blijven van toepassing. Ondersteund: JPG, PNG, WebP, GIF, AVIF, MP4, WebM en MOV. Kies een rol (voor, na, proces, mislukte poging of referentie) en voeg eventueel een bijschrift en credit toe vóór uploaden. Mediabestanden worden direct opgeslagen; teksten met Concept opslaan of Publiceren. Verwijderen ruimt ook Cloudinary-media op.

### Blog API

- `GET /api/blog?page=1`: gepubliceerde berichten, 12 per pagina, met `posts`, `total`, `page`, `pages`.
- `GET /api/blog/:slug`: volledig gepubliceerd bericht.
- `GET /api/blog/admin`: beveiligde lijst van alle berichten.
- `GET /api/blog/admin/:id`: beveiligd volledig bericht, inclusief concepten.
- `POST /api/blog`: JSON `{ "title": "Mijn concrete titel" }`, maakt een concept.
- `PUT /api/blog/:id`: JSON met `title`, `summary`, `context`, `process`, `learning`, `reflection`, `planning`, `sources`, `aiUsed`, `aiContribution`, `humanContribution`, `status` (`draft` of `published`). De slug blijft stabiel bij titelwijzigingen.
- `POST /api/blog/:id/media`: FormData met één `file`, `role` (`before`, `after`, `process`, `failed`, `reference`), optioneel `caption` en `credit`. Herhaal voor zoveel bestanden als nodig.
- `DELETE /api/blog/:id/media/:mediaId`: verwijdert media. Verplicht voor/na-beeld kan alleen verwijderd worden wanneer het bericht een concept is, of wanneer nog ander beeld met dezelfde rol bestaat.
- `DELETE /api/blog/:id`: verwijdert het bericht en de media.

Alle beheerroutes gebruiken `Authorization: Bearer TOKEN`. Tekst wordt als gewone tekst getoond; HTTP(S)-links in bronnen zijn klikbaar. De beheerpagina bewaart de login alleen in sessionStorage.

Blogtests uitvoeren: `node --test test/*.test.js` vanuit `portfolio-backend`. De tests vereisen geen echte database of Cloudinary-account.
