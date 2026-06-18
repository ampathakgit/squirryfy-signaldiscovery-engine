# Squirryfy Signal Discovery Engine

An automated regional internet attention scanner and discovery pipeline for Squirry AI Engine, built with Next.js, Supabase, and Gemini.

---

## Getting Started

### Local Development

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Configure Environment Variables**:
   Create a `.env` file in the root directory:
   ```env
   DATABASE_URL="postgresql://..."
   SUPABASE_URL="https://..."
   SUPABASE_ANON_KEY="eyJ..."
   GEMINI_API_KEY="AIzaSy..."
   SQUIRRY_API_URL="https://..."
   SQUIRRY_API_KEY="sq_..."
   ```

3. **Database Setup & Seed**:
   Run the seed script to populate regions, categories, source weights, and scoring rules:
   ```bash
   npx prisma db push
   npx tsx src/scripts/seed.ts
   ```

4. **Start Dev Server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) to view the Signal Discovery dashboard.

5. **Run Tests**:
   ```bash
   npx tsx src/lib/pipeline/tests/run.ts
   ```

---

## Production Deployment & CI/CD

We use **Terraform** to provision virtual server infrastructure on Hetzner Cloud and **GitHub Actions** for automated build and continuous deployment (CI/CD).

### 1. GitHub Secrets Setup
Before running the workflows, you must set up the following secrets in your GitHub repository (**Settings > Secrets and variables > Actions > Repository secrets**):

| Secret Name | Description | Source / How to Obtain |
| :--- | :--- | :--- |
| `HCLOUD_TOKEN` | Hetzner Cloud Read/Write API Token | Hetzner Console > Security > API Tokens |
| `GH_PAT` | Personal Access Token with secrets write | GitHub Settings > Developer Settings > PATs |
| `SUPABASE_URL` | Production Supabase URL (injected on boot) | Supabase Project Settings |
| `SUPABASE_ANON_KEY` | Production Supabase Anon Key | Supabase Project Settings |

*Note: `GH_PAT` is required to allow the Terraform workflow to automatically write the generated `SSH_PRIVATE_KEY`, `SSH_PUBLIC_KEY`, and `SERVER_IP` secrets back to your repository.*

### 2. Infrastructure Provisioning (Terraform)
The infrastructure workflow runs on-demand to provision the server:

1. In your GitHub repository, go to **Actions** > **Squirryfy Infrastructure (Terraform)**.
2. Click **Run workflow** and select the `main` branch.
3. The workflow will:
   - Run `terraform init` and `terraform apply`.
   - Dynamically generate a secure SSH key pair using `tls_private_key`.
   - Provision a `cx22` server (Ubuntu 24.04) in Hetzner's US Ashburn location (`ash`).
   - Automatically write the `SERVER_IP`, `SSH_PUBLIC_KEY`, and `SSH_PRIVATE_KEY` secrets back to GitHub.

#### Manual Local Execution
If you wish to run Terraform locally instead of via CI/CD:
```bash
# Initialize Terraform
terraform init

# Plan changes
terraform plan -var="hcloud_token=$HCLOUD_TOKEN"

# Apply changes
terraform apply -var="hcloud_token=$HCLOUD_TOKEN"
```

### 3. DNS Mapping
Once the infrastructure is successfully created:
1. Note the `server_ip` output from the Terraform execution (or check `SERVER_IP` in GitHub Secrets).
2. Go to your external domain registrar (e.g., GoDaddy, Namecheap, Route53).
3. Create or update an **A Record** pointing your domain (e.g., `discovery.squirryfy.com`) to the server IP.
4. Update the domain placeholder `[YOUR_DOMAIN_HERE]` in [cloud-init.yaml](file:///Users/amitpathak/Documents/antigravity_working/squirryfy-signaldiscovery-engine/cloud-init.yaml) with your actual domain. Caddy will automatically provision and renew a free Let's Encrypt SSL certificate.

### 4. Build & Continuous Deployment
1. Every time you push a change to the `main` branch, the **Squirryfy Build and Deploy** workflow is automatically triggered.
2. It compiles the Next.js app in `standalone` mode, builds a lightweight Docker container, and pushes it to GitHub Container Registry (GHCR).
3. It logs into the Hetzner VM via SSH using the synced private key, pulls the latest image, stops the old container, and spins up the new container with the production Supabase environment variables.
