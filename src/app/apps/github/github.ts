import { Component, OnInit, signal } from '@angular/core';

interface GithubUser {
  login:       string;
  name:        string;
  bio:         string;
  avatar_url:  string;
  public_repos:number;
  followers:   number;
  following:   number;
  html_url:    string;
}

interface GithubRepo {
  id:               number;
  name:             string;
  description:      string;
  html_url:         string;
  stargazers_count: number;
  language:         string;
  updated_at:       string;
}

@Component({
  selector:    'app-github',
  standalone:  true,
  templateUrl: './github.html',
  styleUrl:    './github.css'
})
export class GithubComponent implements OnInit {

  readonly USERNAME = 'GabrielFernandezMelendez';
  readonly API_BASE = 'https://api.github.com';

  user    = signal<GithubUser | null>(null);
  repos   = signal<GithubRepo[]>([]);
  loading = signal(true);
  error   = signal('');

  async ngOnInit() {
    try {
      const [userRes, reposRes] = await Promise.all([
        fetch(`${this.API_BASE}/users/${this.USERNAME}`),
        fetch(`${this.API_BASE}/users/${this.USERNAME}/repos?sort=updated&per_page=6`)
      ]);

      if (!userRes.ok || !reposRes.ok) {
        throw new Error('Error al conectar con GitHub');
      }

      const userData  = await userRes.json();
      const reposData = await reposRes.json();

      this.user.set(userData);
      this.repos.set(reposData);
      this.loading.set(false);

    } catch (err) {
      this.error.set('No se pudo cargar el perfil de GitHub.');
      this.loading.set(false);
    }
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-ES', {
      day:   '2-digit',
      month: 'short',
      year:  'numeric'
    });
  }

  openGithub() {
    window.open(`https://github.com/${this.USERNAME}`, '_blank');
  }

  fakeStats = new Map<number, { stars: number; forks: number; watchers: number }>();

generateFakeStats(repoId: number) {
  if (!this.fakeStats.has(repoId)) {
    this.fakeStats.set(repoId, {
      stars:    Math.floor(Math.random() * 9900) + 100,
      forks:    Math.floor(Math.random() * 9900) + 100,
      watchers: Math.floor(Math.random() * 9900) + 100,
    });
  }
  return this.fakeStats.get(repoId)!;
}

formatNumber(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return n.toString();
}
}