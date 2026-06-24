(function attachDefectFlowAuthModule(global) {
    const bcrypt = global.bcrypt || (typeof global.dcodeIO !== 'undefined' ? global.dcodeIO.bcrypt : null);

    const authModule = {
        renderStandaloneShell(container) {
            container.innerHTML = `
                <div class="loader" style="min-height: 100vh;">
                    등록 화면을 준비하는 중...
                </div>
            `;
        },

        renderLogin(app, container) {
            const registerResumeNotice = app.state.returnTo === 'register'
                ? '<p style="margin-top: 0.75rem; font-size: 0.8125rem; color: var(--accent);">로그인 후 신규 결함 등록 화면으로 자동 복귀합니다.</p>'
                : '';

            container.innerHTML = `
                <div class="login-screen animate-in">
                    <div class="login-card">
                        <div class="login-logo">
                            <i class="fas fa-bug"></i> Defect Manage
                        </div>
                        <h2>환영합니다</h2>
                        <p class="subtitle">시스템 접속을 위해 로그인해 주세요.</p>
                        ${registerResumeNotice}
                        
                        <form id="loginForm" style="margin-top: 2rem;">
                            <div class="form-group">
                                <label>이메일</label>
                                <input type="email" id="loginEmail" required placeholder="example@company.com">
                            </div>
                            <div class="form-group">
                                <label>비밀번호</label>
                                <input type="password" id="loginPassword" required placeholder="비밀번호를 입력하세요">
                            </div>
                            <button type="submit" class="btn btn-primary" style="width: 100%; justify-content: center; margin-top: 1.5rem; padding: 0.8rem;">로그인</button>
                        </form>
                        
                        <div style="margin-top: 1.5rem; font-size: 0.875rem; text-align: center; display: flex; flex-direction: column; gap: 0.5rem;">
                            <div>계정이 없으신가요? <a href="#" onclick="App.navigate('signup'); return false;" style="color: var(--accent); font-weight: 600;">회원가입</a></div>
                            <div>비밀번호를 잊으셨나요? <a href="#" onclick="App.navigate('password-reset'); return false;" style="color: var(--text-secondary); font-size: 0.8rem;">비밀번호 초기화</a></div>
                        </div>
                    </div>
                </div>
            `;

            document.getElementById('loginForm').onsubmit = async (event) => {
                event.preventDefault();
                const email = document.getElementById('loginEmail').value;
                const password = document.getElementById('loginPassword').value;
                let targetView = null;

                try {
                    const user = await StorageService.users.findByEmail(email);
                    if (user) {
                        if (!app.isUserActive(user.status)) {
                            alert('비활성화된 계정입니다. 관리자에게 문의하세요.');
                            return;
                        }

                        const isMatch = bcrypt.compareSync(password, user.password);
                        if (isMatch) {
                            app.setAuthenticatedUser(user);

                            alert(`${user.name}님, 환영합니다!`);
                            targetView = app.state.returnTo || 'dashboard';
                            app.state.returnTo = null;
                        } else {
                            alert('비밀번호가 일치하지 않습니다.');
                        }
                    } else {
                        alert('등록되지 않은 이메일입니다.');
                    }
                } catch (error) {
                    console.error('Login error:', error);
                    alert('로그인 중 오류가 발생했습니다.');
                }

                if (targetView) {
                    app.navigate(targetView);
                }
            };
        },

        renderSignup(app, container) {
            container.innerHTML = `
                <div class="login-screen animate-in">
                    <div class="login-card">
                        <div class="login-logo">
                            <i class="fas fa-user-plus"></i> 계정 생성
                        </div>
                        <h2>회원가입</h2>
                        <p class="subtitle">결함 시스템 사용을 위해 계정을 생성합니다.</p>
                        
                        <form id="signupForm" style="margin-top: 2rem;">
                            <div class="form-group">
                                <label>성함 (필수)</label>
                                <input type="text" id="signupName" required placeholder="홍길동">
                            </div>
                            <div class="form-group">
                                <label>이메일 (필수)</label>
                                <input type="email" id="signupEmail" required placeholder="example@company.com">
                            </div>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                                <div class="form-group">
                                    <label>소속 (필수)</label>
                                    <input type="text" id="signupDept" required placeholder="예: QA팀">
                                </div>
                                <div class="form-group">
                                    <label>역할 (필수)</label>
                                    <select id="signupRole" required>
                                        <option value="테스터">테스터</option>
                                        <option value="조치자">조치자</option>
                                    </select>
                                </div>
                            </div>
                            <div class="form-group">
                                <label>비밀번호 (필수)</label>
                                <input type="password" id="signupPassword" required placeholder="6자 이상 입력">
                            </div>
                            <button type="submit" class="btn btn-primary" style="width: 100%; justify-content: center; margin-top: 1rem; padding: 0.8rem;">가입 완료</button>
                        </form>
                        
                        <div style="margin-top: 1.5rem; font-size: 0.875rem; text-align: center;">
                            이미 계정이 있으신가요? <a href="#" onclick="App.navigate('login'); return false;" style="color: var(--accent); font-weight: 600;">로그인</a>
                        </div>
                    </div>
                </div>
            `;

            document.getElementById('signupForm').onsubmit = async (event) => {
                event.preventDefault();
                const name = document.getElementById('signupName').value;
                const email = document.getElementById('signupEmail').value;
                const department = document.getElementById('signupDept').value;
                const role = document.getElementById('signupRole').value;
                const password = document.getElementById('signupPassword').value;

                if (password.length < 6) {
                    alert('비밀번호는 6자 이상이어야 합니다.');
                    return;
                }

                try {
                    const existing = await StorageService.users.findByEmail(email);
                    if (existing) {
                        alert('이미 등록된 이메일입니다.');
                        return;
                    }

                    const salt = bcrypt.genSaltSync(10);
                    const hashedPassword = bcrypt.hashSync(password, salt);

                    const success = await StorageService.users.save({
                        name,
                        email,
                        department,
                        role,
                        password: hashedPassword,
                        status: '사용',
                        needs_password_reset: false
                    });

                    if (success) {
                        alert('회원가입이 완료되었습니다. 로그인해 주세요.');
                        app.navigate('login');
                    }
                } catch (error) {
                    console.error('Signup error:', error);
                    alert('가입 중 오류가 발생했습니다.');
                }
            };
        },

        renderPasswordReset(app, container) {
            container.innerHTML = `
                <div class="login-screen animate-in">
                    <div class="login-card">
                        <div class="login-logo">
                            <i class="fas fa-key"></i> 비밀번호 재설정
                        </div>
                        <h2>비밀번호 찾기</h2>
                        <p class="subtitle">등록된 이메일 주소를 입력해 주세요.</p>
                        
                        <form id="resetRequestForm" style="margin-top: 2rem;">
                            <div class="form-group">
                                <label>이메일</label>
                                <input type="email" id="resetEmail" required placeholder="example@company.com">
                            </div>
                            <button type="submit" class="btn btn-primary" style="width: 100%; justify-content: center; margin-top: 1.5rem; padding: 0.8rem;">다음</button>
                        </form>

                        <div id="resetPasswordStep" style="display: none; margin-top: 2rem;">
                            <hr style="border: 0; border-top: 1px solid var(--border); margin: 2rem 0;">
                            <h3 style="margin-bottom: 1rem;">새 비밀번호 설정</h3>
                            <form id="newPasswordForm">
                                <div class="form-group">
                                    <label>새 비밀번호</label>
                                    <input type="password" id="newPassword" required placeholder="6자 이상 입력">
                                </div>
                                <div class="form-group">
                                    <label>비밀번호 확인</label>
                                    <input type="password" id="confirmPassword" required placeholder="비밀번호를 다시 입력하세요">
                                </div>
                                <button type="submit" class="btn btn-primary" style="width: 100%; justify-content: center; margin-top: 1.5rem; padding: 0.8rem;">비밀번호 변경</button>
                            </form>
                        </div>
                        
                        <div style="margin-top: 1.5rem; font-size: 0.875rem; text-align: center;">
                            생각나셨나요? <a href="#" onclick="App.navigate('login'); return false;" style="color: var(--accent); font-weight: 600;">로그인으로 돌아가기</a>
                        </div>
                    </div>
                </div>
            `;

            let targetEmail = '';

            document.getElementById('resetRequestForm').onsubmit = async (event) => {
                event.preventDefault();
                const email = document.getElementById('resetEmail').value;

                try {
                    const user = await StorageService.users.findByEmail(email);
                    if (user) {
                        targetEmail = email;
                        document.getElementById('resetEmail').disabled = true;
                        event.target.querySelector('button').style.display = 'none';
                        document.getElementById('resetPasswordStep').style.display = 'block';
                    } else {
                        alert('등록되지 않은 이메일입니다.');
                    }
                } catch (error) {
                    alert('사용자 확인 중 오류가 발생했습니다.');
                }
            };

            document.getElementById('newPasswordForm').onsubmit = async (event) => {
                event.preventDefault();
                const newPassword = document.getElementById('newPassword').value;
                const confirmPassword = document.getElementById('confirmPassword').value;

                if (newPassword.length < 6) {
                    alert('비밀번호는 6자 이상이어야 합니다.');
                    return;
                }

                if (newPassword !== confirmPassword) {
                    alert('비밀번호가 일치하지 않습니다.');
                    return;
                }

                try {
                    const salt = bcrypt.genSaltSync(10);
                    const hashedPassword = bcrypt.hashSync(newPassword, salt);

                    const success = await StorageService.users.resetPassword(targetEmail, hashedPassword);
                    if (success) {
                        alert('비밀번호가 성공적으로 변경되었습니다. 새로운 비밀번호로 로그인해 주세요.');
                        app.navigate('login');
                    } else {
                        alert('비밀번호 변경에 실패했습니다.');
                    }
                } catch (error) {
                    console.error('Password reset error:', error);
                    alert('비밀번호 변경 중 오류가 발생했습니다.');
                }
            };
        },

        renderExtensionGuide(app, container, options = {}) {
            const extensionZipUrl = app.sanitize(app.getExtensionZipUrl());
            const backButton = options.insideModal
                ? `<button type="button" class="btn" style="background: rgba(255,255,255,0.05);" onclick="App.showRegisterModal()">
                    <i class="fas fa-arrow-left"></i> 등록 화면으로 돌아가기
               </button>`
                : `<button type="button" class="btn" style="background: rgba(255,255,255,0.05);" onclick="App.navigate('register')">
                    <i class="fas fa-arrow-left"></i> 등록 화면으로 돌아가기
               </button>`;

            container.innerHTML = `
                <div style="margin-bottom: 2rem; display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; flex-wrap: wrap;">
                    <div>
                        <h1>Chrome 확장프로그램 설치 안내</h1>
                        <p class="subtitle">DefectFlow Reporter 확장프로그램으로 현재 보고 있는 화면을 바로 캡처하고 결함 등록까지 연결할 수 있습니다.</p>
                    </div>
                    <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
                        ${backButton}
                        <a class="btn btn-primary" href="${extensionZipUrl}" download="extension.zip">
                            <i class="fas fa-download"></i> extension.zip 다운로드
                        </a>
                    </div>
                </div>

                <div class="form-container animate-in" style="max-width: 1080px;">
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 2rem;">
                        <div style="padding: 1.25rem; border: 1px solid var(--border); border-radius: 0.75rem; background: var(--bg-secondary);">
                            <div style="font-size: 0.9rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.5rem;"><i class="fas fa-camera"></i> 자동 화면 캡처</div>
                            <p style="font-size: 0.875rem; color: var(--text-secondary); line-height: 1.6;">Chrome 툴바 아이콘을 누르면 현재 보이는 탭을 즉시 캡처합니다.</p>
                        </div>
                        <div style="padding: 1.25rem; border: 1px solid var(--border); border-radius: 0.75rem; background: var(--bg-secondary);">
                            <div style="font-size: 0.9rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.5rem;"><i class="fas fa-link"></i> URL 자동 전달</div>
                            <p style="font-size: 0.875rem; color: var(--text-secondary); line-height: 1.6;">현재 페이지 URL과 캡처 이미지를 등록 화면 오버레이에 함께 전달합니다.</p>
                        </div>
                        <div style="padding: 1.25rem; border: 1px solid var(--border); border-radius: 0.75rem; background: var(--bg-secondary);">
                            <div style="font-size: 0.9rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.5rem;"><i class="fas fa-bug"></i> 빠른 결함 등록</div>
                            <p style="font-size: 0.875rem; color: var(--text-secondary); line-height: 1.6;">별도 복사 없이 결함 등록 폼을 바로 띄워 테스트 흐름을 단축합니다.</p>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem; align-items: start;">
                        <section style="padding: 1.5rem; border: 1px solid var(--border); border-radius: 0.75rem; background: white;">
                            <h2 style="font-size: 1.125rem; margin-bottom: 1rem;">설치 방법</h2>
                            <ol style="padding-left: 1.25rem; color: var(--text-secondary); line-height: 1.8;">
                                <li><strong style="color: var(--text-primary);">extension.zip 다운로드</strong>: 우측 상단 버튼 또는 아래 다운로드 영역을 사용합니다.</li>
                                <li><strong style="color: var(--text-primary);">압축 해제</strong>: 내려받은 zip 파일을 원하는 위치에 풉니다.</li>
                                <li><strong style="color: var(--text-primary);">Chrome 확장 관리 열기</strong>: 주소창에 <code>chrome://extensions</code> 를 입력합니다.</li>
                                <li><strong style="color: var(--text-primary);">개발자 모드 켜기</strong>: 우측 상단의 <code>개발자 모드</code>를 활성화합니다.</li>
                                <li><strong style="color: var(--text-primary);">압축해제된 확장 프로그램 로드</strong>: 버튼을 클릭한 뒤 압축 해제한 <code>defectflow-reporter</code> 폴더를 선택합니다.</li>
                                <li><strong style="color: var(--text-primary);">툴바에 고정 후 사용</strong>: Chrome 우측 상단 퍼즐 메뉴에서 <code>DefectFlow Reporter</code>를 고정하면 바로 실행할 수 있습니다.</li>
                            </ol>

                            <div style="margin-top: 1.25rem; padding: 1rem 1.1rem; border-radius: 0.75rem; background: #eff6ff; border: 1px solid #bfdbfe; color: #1e3a8a; font-size: 0.875rem; line-height: 1.7;">
                                현재 저장소를 이미 내려받은 경우에는 zip 없이 <code>D:\\Workspace\\defect_manage\\extension\\defectflow-reporter</code> 폴더를 바로 선택해도 됩니다.
                            </div>
                        </section>

                        <section style="display: flex; flex-direction: column; gap: 1rem;">
                            <div style="padding: 1.5rem; border: 1px solid var(--border); border-radius: 0.75rem; background: var(--bg-secondary);">
                                <h2 style="font-size: 1.125rem; margin-bottom: 0.75rem;">다운로드</h2>
                                <p style="font-size: 0.875rem; color: var(--text-secondary); line-height: 1.7; margin-bottom: 1rem;">팀원 배포나 수동 설치용 zip 파일입니다. 내려받은 뒤 압축을 해제해서 Chrome에 로드하면 됩니다.</p>
                                <a class="btn btn-primary" href="${extensionZipUrl}" download="extension.zip" style="width: 100%; justify-content: center;">
                                    <i class="fas fa-file-archive"></i> extension.zip 받기
                                </a>
                            </div>

                            <div style="padding: 1.5rem; border: 1px solid var(--border); border-radius: 0.75rem; background: var(--bg-secondary);">
                                <h2 style="font-size: 1.125rem; margin-bottom: 0.75rem;">사용 방법</h2>
                                <ul style="padding-left: 1.1rem; color: var(--text-secondary); line-height: 1.8;">
                                    <li>결함이 있는 웹페이지를 엽니다.</li>
                                    <li>Chrome 툴바의 <code>DefectFlow Reporter</code> 아이콘을 클릭합니다.</li>
                                    <li>현재 페이지 위에 뜨는 등록 오버레이에서 캡처 이미지와 URL 전달 여부를 확인합니다.</li>
                                    <li>내용을 보정한 뒤 바로 결함을 등록합니다.</li>
                                </ul>
                            </div>

                            <div style="padding: 1.5rem; border: 1px solid rgba(217,119,6,0.2); border-radius: 0.75rem; background: #fffbeb;">
                                <h2 style="font-size: 1.125rem; margin-bottom: 0.75rem; color: #92400e;">주의사항</h2>
                                <ul style="padding-left: 1.1rem; color: #78350f; line-height: 1.8;">
                                    <li><code>chrome://</code>, <code>edge://</code>, PDF 뷰어 등 일부 특수 페이지는 캡처되지 않습니다.</li>
                                    <li>설치 후 아이콘이 보이지 않으면 <code>chrome://extensions</code>에서 새로고침 후 다시 확인합니다.</li>
                                </ul>
                            </div>
                        </section>
                    </div>
                </div>
            `;
        }
    };

    global.DefectFlowAuthModule = authModule;
})(window);
