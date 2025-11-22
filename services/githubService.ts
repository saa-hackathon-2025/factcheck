
interface GithubFile {
  path: string;
  type: 'blob' | 'tree';
  url: string;
  score?: number;
}

export interface RepoContext {
  structure: string;
  fileContents: string;
  summary: string;
}

// Helper to extract owner/repo from URL
const parseGithubUrl = (url: string): { owner: string; repo: string } | null => {
  try {
    const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (match) {
      return { owner: match[1], repo: match[2].replace('.git', '') };
    }
    return null;
  } catch (e) {
    return null;
  }
};

// Helper to score file importance for fetching context
const scoreFileImportance = (path: string): number => {
  const lower = path.toLowerCase();
  if (lower.includes('readme.md')) return 100;
  if (lower.includes('package.json') || lower.includes('pom.xml') || lower.includes('requirements.txt')) return 90;
  if (lower.includes('docker') || lower.includes('k8s') || lower.includes('helm')) return 85;
  if (lower.includes('config') || lower.includes('settings') || lower.includes('application.y')) return 80;
  if (lower.includes('controller') || lower.includes('service') || lower.includes('api')) return 70;
  if (lower.endsWith('.ts') || lower.endsWith('.js') || lower.endsWith('.java') || lower.endsWith('.py') || lower.endsWith('.go')) return 50;
  if (lower.includes('test') || lower.includes('spec')) return 20;
  if (lower.endsWith('.lock') || lower.endsWith('.png') || lower.endsWith('.jpg')) return 0;
  return 10;
};

// Helper for delay
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const fetchSingleRepoData = async (url: string, token?: string): Promise<RepoContext> => {
  const repoInfo = parseGithubUrl(url);
  if (!repoInfo) {
    throw new Error(`유효하지 않은 GitHub URL입니다: ${url}`);
  }

  const { owner, repo } = repoInfo;
  
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
  };

  const hasToken = token && token.trim().length > 0;

  if (hasToken) {
    headers['Authorization'] = `Bearer ${token.trim()}`;
  }

  try {
    // 1. Get Default Branch & Private Status
    const metaResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
    
    if (!metaResponse.ok) {
        if(metaResponse.status === 401) {
             throw new Error("GitHub Token이 유효하지 않습니다 (401 Unauthorized). 토큰을 확인해주세요.");
        }
        if(metaResponse.status === 403 || metaResponse.status === 429) {
             throw new Error("GitHub API 요청 제한을 초과했습니다. Input Form 하단의 'API Rate Limit 해제'를 열어 Token을 입력하거나, 1시간 후 다시 시도해주세요.");
        }
        if(metaResponse.status === 404) {
             throw new Error(`레포지토리를 찾을 수 없습니다 (${owner}/${repo}). Private 레포지토리라면 Token을 입력해주세요.`);
        }
        throw new Error(`GitHub API Error (${owner}/${repo}): ${metaResponse.statusText}`);
    }
    
    const meta = await metaResponse.json();
    const defaultBranch = meta.default_branch || 'main';
    const isPrivate = meta.private;

    // 2. Get File Tree (Recursive)
    const treeResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`, { headers });
    if (!treeResponse.ok) {
        throw new Error(`파일 구조를 가져오는데 실패했습니다 (${owner}/${repo}).`);
    }
    
    const treeData = await treeResponse.json();
    const files: GithubFile[] = treeData.tree;

    // Generate Tree Structure String
    const structure = files
      .filter(f => f.type === 'blob')
      .map(f => f.path)
      .slice(0, 500)
      .join('\n');

    // 3. Select Top Files to Fetch Content
    const sortedFiles = files
      .filter(f => f.type === 'blob' && f.url)
      .map(f => ({ ...f, score: scoreFileImportance(f.path) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);

    // 4. Fetch Content (Sequential)
    const contents: string[] = [];
    
    for (const file of sortedFiles) {
      try {
        // Optimization: Use Raw content for public repos to avoid API Rate Limit
        // If private, we MUST use the API blob URL with the token.
        let content = '';
        
        if (!isPrivate) {
          // Use raw.githubusercontent.com for Public Repos
          // Encode path parts correctly
          const encodedPath = file.path.split('/').map(encodeURIComponent).join('/');
          const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${defaultBranch}/${encodedPath}`;
          
          const res = await fetch(rawUrl);
          if (!res.ok) throw new Error(`Raw fetch failed: ${res.status}`);
          content = await res.text();
          
        } else {
          // Use API Blob URL for Private Repos
          await wait(100); // throttle API calls slightly
          const res = await fetch(file.url, { headers });
          if (!res.ok) throw new Error(`API fetch failed: ${res.status}`);
          
          const data = await res.json();
          if (!data.content) continue;
          
          // Decoding logic (Base64 -> UTF-8)
          const binaryString = atob(data.content.replace(/\n/g, ''));
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          const decoder = new TextDecoder('utf-8');
          content = decoder.decode(bytes);
        }

        if (content) {
           contents.push(`\n--- START OF FILE: ${owner}/${repo}/${file.path} ---\n${content.substring(0, 50000)}\n--- END OF FILE ---`);
        }

      } catch (e) {
        contents.push(`\n--- ERROR FETCHING: ${file.path} ---`);
      }
    }

    return {
      structure: `Directory Structure (Repo: ${owner}/${repo}):\n${structure}`,
      fileContents: contents.join('\n'),
      summary: `Repo ${owner}/${repo}: ${files.length} files.`
    };

  } catch (error: any) {
    console.error("GitHub Fetch Error:", error);
    if (error.message.includes('GitHub')) {
        throw error;
    }
    throw new Error(`GitHub 데이터 가져오기 실패: ${error.message}`);
  }
};

export const fetchRepoData = async (urls: string[], token?: string): Promise<RepoContext> => {
  const results: RepoContext[] = [];
  
  for (const url of urls) {
      const result = await fetchSingleRepoData(url, token);
      results.push(result);
  }
  
  return {
    structure: results.map(r => r.structure).join('\n\n'),
    fileContents: results.map(r => r.fileContents).join('\n'),
    summary: results.map(r => r.summary).join(', ')
  };
};
