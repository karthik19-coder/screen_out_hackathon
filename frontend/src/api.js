const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

async function handleResponse(response) {
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error((errorData && errorData.detail) || `API Error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

export const getArtifacts = async () => {
  const response = await fetch(`${API_BASE_URL}/artifacts`);
  return handleResponse(response);
};

export const createArtifact = async (title, content) => {
  const response = await fetch(`${API_BASE_URL}/artifacts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, content })
  });
  return handleResponse(response);
};

export const createArtifactVersion = async (artifactId, content, branchName = 'main', parentId = null) => {
  const response = await fetch(`${API_BASE_URL}/artifacts/${artifactId}/versions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, branch_name: branchName, parent_id: parentId })
  });
  return handleResponse(response);
};

export const getArtifactVersions = async (artifactId, branch = null) => {
  let url = `${API_BASE_URL}/artifacts/${artifactId}/versions`;
  if (branch) {
      url += `?branch=${encodeURIComponent(branch)}`;
  }
  const response = await fetch(url);
  return handleResponse(response);
};

export const getArtifactVersion = async (artifactId, versionId) => {
  const response = await fetch(`${API_BASE_URL}/artifacts/${artifactId}/versions/${versionId}`);
  return handleResponse(response);
};

export const compareArtifactVersions = async (artifactId, baseVersionId, headVersionId) => {
  const response = await fetch(`${API_BASE_URL}/artifacts/${artifactId}/compare?base_version_id=${baseVersionId}&head_version_id=${headVersionId}`);
  return handleResponse(response);
};

export const getBranches = async (artifactId) => {
  const response = await fetch(`${API_BASE_URL}/artifacts/${artifactId}/branches`);
  return handleResponse(response);
};

export const uploadArtifact = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch(`${API_BASE_URL}/artifacts/upload`, {
    method: 'POST',
    body: formData
  });
  return handleResponse(response);
};

export const searchArtifacts = async (query) => {
  const response = await fetch(`${API_BASE_URL}/search?q=${encodeURIComponent(query)}`);
  return handleResponse(response);
};

export const deleteArtifact = async (artifactId) => {
  const response = await fetch(`${API_BASE_URL}/artifacts/${artifactId}`, {
    method: 'DELETE'
  });
  return handleResponse(response);
};

export const checkMerge = async (artifactId, sourceBranch, targetBranch) => {
  const response = await fetch(`${API_BASE_URL}/artifacts/${artifactId}/merge-check?source=${encodeURIComponent(sourceBranch)}&target=${encodeURIComponent(targetBranch)}`);
  return handleResponse(response);
};
