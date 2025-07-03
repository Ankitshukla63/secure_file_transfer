// Utility Functions
const API_BASE_URL = 'http://127.0.0.1:8000/api/';

function getToken() {
    return localStorage.getItem('access_token');
}

function setToken(access, refresh) {
    localStorage.setItem('access_token', access);
    localStorage.setItem('refresh_token', refresh);
}

function removeTokens() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
}

function decodeToken(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) {
        console.error("Error decoding token:", e);
        return null;
    }
}

function getUserType() {
    const token = getToken();
    if (token) {
        const decoded = decodeToken(token);
        if (decoded && decoded.user_type) {
            return decoded.user_type;
        }
    }
    return null;
}

function getUserId() {
    const token = getToken();
    if (token) {
        const decoded = decodeToken(token);
        if (decoded && decoded.user_id) {
            return decoded.user_id;
        }
    }
    return null;
}

function showSection(sectionId) {
    document.querySelectorAll('section').forEach(sec => {
        sec.classList.add('hidden-section');
    });
    document.getElementById(sectionId).classList.remove('hidden-section');

    document.querySelectorAll('nav button').forEach(btn => {
        btn.classList.remove('active');
    });
    // Set active class for the corresponding nav button
    if (sectionId === 'home-section') document.getElementById('nav-home').classList.add('active');
    if (sectionId === 'auth-section') document.getElementById('nav-login').classList.add('active'); // Login/Signup share auth section
    if (sectionId === 'ops-dashboard-section') document.getElementById('nav-ops-dashboard').classList.add('active');
    if (sectionId === 'client-dashboard-section') document.getElementById('nav-client-dashboard').classList.add('active');
}

function updateNavigation() {
    const userType = getUserType();
    const isLoggedIn = !!getToken();

    document.getElementById('nav-login').style.display = isLoggedIn ? 'none' : 'inline-block';
    document.getElementById('nav-signup').style.display = isLoggedIn ? 'none' : 'inline-block';
    document.getElementById('nav-logout').style.display = isLoggedIn ? 'inline-block' : 'none';

    document.getElementById('nav-ops-dashboard').style.display = (isLoggedIn && userType === 'ops_user') ? 'inline-block' : 'none';
    document.getElementById('nav-client-dashboard').style.display = (isLoggedIn && userType === 'client_user') ? 'inline-block' : 'none';

    if (!isLoggedIn) {
        showSection('home-section');
    } else if (userType === 'ops_user') {
        showSection('ops-dashboard-section');
    } else if (userType === 'client_user') {
        showSection('client-dashboard-section');
        fetchFilesForClient();
    }
}

function displayMessage(elementId, message, type = 'info') {
    const element = document.getElementById(elementId);
    element.textContent = message;
    element.className = `message ${type}`;
    element.style.display = 'block';
    setTimeout(() => {
        element.style.display = 'none';
        element.textContent = '';
    }, 5000); // Hide after 5 seconds
}

// --- Authentication Logic ---
async function handleAuth(event) {
    event.preventDefault();
    const username = document.getElementById('auth-username').value;
    const password = document.getElementById('auth-password').value;
    const email = document.getElementById('auth-email').value;
    const submitBtn = document.getElementById('auth-submit-btn');
    const isLoginMode = submitBtn.textContent === 'Login';

    let url = API_BASE_URL;
    let data = { username, password };

    if (isLoginMode) {
        url += 'token/';
    } else { // Sign Up mode
        url += 'client/signup/';
        data.email = email;
    }

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (response.ok) {
            if (isLoginMode) {
                setToken(result.access, result.refresh);
                displayMessage('auth-message', 'Login successful!', 'success');
                updateNavigation();
            } else { // Sign Up
                displayMessage('auth-message', result.message || 'Sign up successful! Please check your email for verification.', 'success');
                // Optionally switch to login mode after successful signup
                document.getElementById('show-login').click();
            }
        } else {
            displayMessage('auth-message', result.detail || result.message || JSON.stringify(result), 'error');
        }
    } catch (error) {
        console.error('Auth error:', error);
        displayMessage('auth-message', 'An unexpected error occurred.', 'error');
    }
}

function handleLogout() {
    removeTokens();
    updateNavigation();
    showSection('home-section');
    displayMessage('auth-message', 'Logged out successfully.', 'success'); // Using auth-message element for general success
}

// --- Email Verification (for the dedicated verify-email.html page if you had one,
//     but for simplicity, we'll handle it on a general page or link to backend directly) ---
async function handleEmailVerification() {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    if (token) {
        showSection('home-section'); // Show home or a dedicated verification status page
        const messageElement = document.getElementById('auth-message'); // Reuse existing message element

        try {
            const response = await fetch(`${API_BASE_URL}client/verify-email/?token=${token}`, {
                method: 'GET',
            });
            const result = await response.json();
            if (response.ok) {
                displayMessage('auth-message', result.message, 'success');
            } else {
                displayMessage('auth-message', result.message || 'Email verification failed.', 'error');
            }
        } catch (error) {
            console.error('Email verification error:', error);
            displayMessage('auth-message', 'An error occurred during email verification.', 'error');
        }
        // Clear the token from URL to prevent re-verification on refresh
        history.replaceState({}, document.title, window.location.pathname);
    }
}


// --- Ops User Dashboard Logic ---
async function handleFileUpload(event) {
    event.preventDefault();
    const fileInput = document.getElementById('file-input');
    const uploadMessage = document.getElementById('upload-message');
    const file = fileInput.files[0];

    if (!file) {
        displayMessage('upload-message', 'Please select a file to upload.', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch(`${API_BASE_URL}ops/upload/`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${getToken()}`,
            },
            body: formData
        });

        const result = await response.json();
        if (response.ok) {
            displayMessage('upload-message', result.message || 'File uploaded successfully!', 'success');
            fileInput.value = ''; // Clear file input
        } else {
            displayMessage('upload-message', result.message || JSON.stringify(result), 'error');
        }
    } catch (error) {
        console.error('Upload error:', error);
        displayMessage('upload-message', 'An unexpected error occurred during upload.', 'error');
    }
}

// --- Client User Dashboard Logic ---
async function fetchFilesForClient() {
    const fileListElement = document.getElementById('file-list');
    const clientMessage = document.getElementById('client-message');
    fileListElement.innerHTML = ''; // Clear previous list

    try {
        const response = await fetch(`${API_BASE_URL}client/files/`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${getToken()}`,
                'Content-Type': 'application/json',
            },
        });

        const files = await response.json();

        if (response.ok) {
            if (files.length === 0) {
                displayMessage('client-message', 'No files available for download.', 'info');
                return;
            }
            files.forEach(file => {
                const listItem = document.createElement('li');
                listItem.innerHTML = `
                    <span><strong>${file.original_filename}</strong> (${file.file_type.toUpperCase()}) uploaded by ${file.uploader_username} on ${new Date(file.uploaded_at).toLocaleDateString()}</span>
                    <button data-file-id="${file.id}">Download</button>
                `;
                fileListElement.appendChild(listItem);
            });

            // Attach event listeners to download buttons
            fileListElement.querySelectorAll('button').forEach(button => {
                button.addEventListener('click', async (event) => {
                    const fileId = event.target.dataset.fileId;
                    try {
                        const downloadResponse = await fetch(`${API_BASE_URL}client/download-request/${fileId}/`, {
                            method: 'GET',
                            headers: {
                                'Authorization': `Bearer ${getToken()}`,
                                'Content-Type': 'application/json',
                            },
                        });
                        const downloadResult = await downloadResponse.json();
                        if (downloadResponse.ok) {
                            // Redirect user's browser to the secure download link
                            window.location.href = downloadResult['download-link'];
                            displayMessage('client-message', 'Initiating download...', 'success');
                        } else {
                            displayMessage('client-message', downloadResult.message || 'Failed to get download link.', 'error');
                        }
                    } catch (err) {
                        console.error('Download request error:', err);
                        displayMessage('client-message', 'Error requesting download link.', 'error');
                    }
                });
            });
            displayMessage('client-message', '', ''); // Clear messages if files are listed
        } else {
            displayMessage('client-message', files.detail || 'Failed to load files.', 'error');
        }
    } catch (error) {
        console.error('Error fetching files:', error);
        displayMessage('client-message', 'An unexpected error occurred while fetching files.', 'error');
    }
}

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    // Initial navigation update
    updateNavigation();
    handleEmailVerification(); // Check for verification token on page load

    // Navigation Buttons
    document.getElementById('nav-home').addEventListener('click', () => showSection('home-section'));
    document.getElementById('nav-login').addEventListener('click', () => {
        showSection('auth-section');
        document.getElementById('auth-submit-btn').textContent = 'Login';
        document.getElementById('auth-email').style.display = 'none';
        document.getElementById('show-login').classList.add('active-auth-btn');
        document.getElementById('show-signup').classList.remove('active-auth-btn');
    });
    document.getElementById('nav-signup').addEventListener('click', () => {
        showSection('auth-section');
        document.getElementById('auth-submit-btn').textContent = 'Sign Up';
        document.getElementById('auth-email').style.display = 'block';
        document.getElementById('show-signup').classList.add('active-auth-btn');
        document.getElementById('show-login').classList.remove('active-auth-btn');
    });
    document.getElementById('nav-ops-dashboard').addEventListener('click', () => showSection('ops-dashboard-section'));
    document.getElementById('nav-client-dashboard').addEventListener('click', () => {
        showSection('client-dashboard-section');
        fetchFilesForClient();
    });
    document.getElementById('nav-logout').addEventListener('click', handleLogout);

    // Auth Form Toggle
    document.getElementById('show-login').addEventListener('click', () => {
        document.getElementById('auth-submit-btn').textContent = 'Login';
        document.getElementById('auth-email').style.display = 'none';
        document.getElementById('show-login').classList.add('active-auth-btn');
        document.getElementById('show-signup').classList.remove('active-auth-btn');
    });
    document.getElementById('show-signup').addEventListener('click', () => {
        document.getElementById('auth-submit-btn').textContent = 'Sign Up';
        document.getElementById('auth-email').style.display = 'block';
        document.getElementById('show-signup').classList.add('active-auth-btn');
        document.getElementById('show-login').classList.remove('active-auth-btn');
    });

    // Forms Submission
    document.getElementById('auth-form').addEventListener('submit', handleAuth);
    document.getElementById('upload-form').addEventListener('submit', handleFileUpload);
});