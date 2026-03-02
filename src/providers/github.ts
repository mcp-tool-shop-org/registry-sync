import { fetchGitHub, fetchGitHubPaginated } from '../fetch.js';
import type { RepoInfo, ContainerPackage } from '../types.js';

// --- Raw GitHub API response shapes ---

interface GitHubRepo {
  name: string;
  full_name: string;
  language: string | null;
  archived: boolean;
  private: boolean;
  pushed_at: string;
  topics?: string[];
  default_branch: string;
  fork: boolean;
}

interface GitHubContent {
  type: string;
  content?: string;
  encoding?: string;
}

interface GitHubPackage {
  name: string;
  package_type: string;
  created_at: string;
  updated_at: string;
  visibility: string;
}

// --- Public API ---

export async function listOrgRepos(org: string): Promise<RepoInfo[]> {
  const raw = await fetchGitHubPaginated<GitHubRepo>(
    `/orgs/${org}/repos?per_page=100&type=sources&sort=full_name`,
  );

  return raw
    .filter((r) => !r.fork)
    .map((r) => ({
      name: r.name,
      fullName: r.full_name,
      language: r.language,
      archived: r.archived,
      isPrivate: r.private,
      pushedAt: r.pushed_at,
      topics: r.topics ?? [],
      defaultBranch: r.default_branch,
      hasPackageJson: false,
      hasDockerfile: false,
    }));
}

export async function readFileContent(
  owner: string,
  repo: string,
  path: string,
): Promise<string | null> {
  const data = await fetchGitHub<GitHubContent>(
    `/repos/${owner}/${repo}/contents/${path}`,
  );
  if (!data || data.type !== 'file' || !data.content) return null;
  return Buffer.from(data.content, 'base64').toString('utf-8');
}

export interface ParsedPackageJson {
  name?: string;
  version?: string;
  private?: boolean;
  bin?: Record<string, string> | string;
  keywords?: string[];
  description?: string;
}

export async function readPackageJson(
  owner: string,
  repo: string,
): Promise<ParsedPackageJson | null> {
  const content = await readFileContent(owner, repo, 'package.json');
  if (!content) return null;
  try {
    return JSON.parse(content) as ParsedPackageJson;
  } catch {
    return null;
  }
}

export async function hasDockerfile(
  owner: string,
  repo: string,
): Promise<boolean> {
  const data = await fetchGitHub<GitHubContent>(
    `/repos/${owner}/${repo}/contents/Dockerfile`,
  );
  return data !== null;
}

export async function listContainerPackages(
  org: string,
): Promise<ContainerPackage[]> {
  const raw = await fetchGitHubPaginated<GitHubPackage>(
    `/orgs/${org}/packages?package_type=container&per_page=100`,
  );

  return raw.map((p) => ({
    name: p.name,
    packageType: p.package_type,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
    visibility: p.visibility,
  }));
}

export async function hasPublishWorkflow(
  owner: string,
  repo: string,
): Promise<boolean> {
  interface WorkflowList {
    total_count: number;
    workflows: { path: string; name: string }[];
  }

  const data = await fetchGitHub<WorkflowList>(
    `/repos/${owner}/${repo}/actions/workflows`,
  );
  if (!data) return false;

  // Check if any workflow name/path suggests publishing
  const publishKeywords = ['publish', 'release', 'deploy', 'npm'];
  return data.workflows.some((w) => {
    const lower = (w.name + ' ' + w.path).toLowerCase();
    return publishKeywords.some((k) => lower.includes(k));
  });
}
