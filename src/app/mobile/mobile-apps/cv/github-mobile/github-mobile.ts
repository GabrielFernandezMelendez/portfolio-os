import { Component, OnInit, signal, input, inject, computed } from '@angular/core';
import { I18nService } from '../../../../i18n/i18n.service';

interface GithubUser {
  login:        string;
  name:         string;
  bio:          string;
  avatar_url:   string;
  public_repos: number;
  followers:    number;
  following:    number;
  html_url:     string;
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
  selector:    'app-github-mobile',
  standalone:  true,
  templateUrl: './github-mobile.html',
  styleUrl:    './github-mobile.css',
})
export class GithubMobileComponent implements OnInit {

  isDark = input<boolean>(true);
  i18n   = inject(I18nService);
  lang   = computed(() => this.i18n.currentLang());

  readonly USERNAME = 'GabrielFernandezMelendez';
  readonly API_BASE = 'https://api.github.com';

  user    = signal<GithubUser | null>(null);
  repos   = signal<GithubRepo[]>([]);
  loading = signal(true);
  error   = signal('');

  fakeStats = new Map<number, { stars: number; forks: number; watchers: number }>();

  async ngOnInit() {
    try {
      const [userRes, reposRes] = await Promise.all([
        fetch(`${this.API_BASE}/users/${this.USERNAME}`),
        fetch(`${this.API_BASE}/users/${this.USERNAME}/repos?sort=updated&per_page=6`),
      ]);

      if (!userRes.ok || !reposRes.ok) throw new Error();

      this.user.set(await userRes.json());
      this.repos.set(await reposRes.json());
      this.loading.set(false);
    } catch {
      this.error.set(this.i18n.t('github.error'));
      this.loading.set(false);
    }
  }

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
    return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : n.toString();
  }

  openGithub() {
    window.open(`https://github.com/${this.USERNAME}`, '_blank');
  }
}