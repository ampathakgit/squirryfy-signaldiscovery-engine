terraform {
  required_providers {
    hcloud = {
      source  = "hetznercloud/hcloud"
      version = "~> 1.45"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
  }
}

variable "hcloud_token" {
  type      = string
  sensitive = true
}

provider "hcloud" {
  token = var.hcloud_token
}

# Generate SSH key pair dynamically
resource "tls_private_key" "ssh_key" {
  algorithm = "RSA"
  rsa_bits  = 4096
}

resource "hcloud_ssh_key" "ssh_key" {
  name       = "squirryfy-ssh-key"
  public_key = tls_private_key.ssh_key.public_key_openssh
}

resource "hcloud_firewall" "firewall" {
  name = "squirryfy-firewall"

  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "22"
    source_ips = ["0.0.0.0/0", "::/0"]
  }

  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "80"
    source_ips = ["0.0.0.0/0", "::/0"]
  }

  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "443"
    source_ips = ["0.0.0.0/0", "::/0"]
  }
}

resource "hcloud_server" "server" {
  name         = "squirryfy-server"
  image        = "ubuntu-24.04"
  server_type  = "cpx21"
  location     = "ash" # Ashburn, Virginia, USA
  firewall_ids = [hcloud_firewall.firewall.id]
  ssh_keys     = [hcloud_ssh_key.ssh_key.id]
  user_data    = file("${path.module}/cloud-init.yaml")
}

# Outputs for automated GitHub secrets synchronization
output "server_ip" {
  value = hcloud_server.server.ipv4_address
}

output "public_key" {
  value = tls_private_key.ssh_key.public_key_openssh
}

output "private_key" {
  value     = tls_private_key.ssh_key.private_key_pem
  sensitive = true
}
