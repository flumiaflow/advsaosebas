import axios from 'axios';

const api = axios.create({ baseURL: 'http://localhost:4000/api' });

async function runTests() {
  console.log('🚀 Iniciando Testes de API da Fase 1 MVP...');
  let token = '';

  try {
    // 1. Login
    console.log('\n[1] Testando Login do Super Admin...');
    const loginRes = await api.post('/auth/login', {
      email: 'admin@juriswatch.com',
      password: 'Admin123!'
    });
    console.log('✅ Login bem-sucedido!');
    token = loginRes.data.accessToken;
    
    // Set token for future requests
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

    // 2. Auth Me
    console.log('\n[2] Buscando Perfil (/auth/me)...');
    const meRes = await api.get('/auth/me');
    console.log(`✅ Perfil: ${meRes.data.user.name} (${meRes.data.user.role})`);

    // 3. Listar Tenants
    console.log('\n[3] Listando Escritórios (/tenants)...');
    const tenantsRes = await api.get('/tenants');
    console.log(`✅ Escritórios encontrados: ${tenantsRes.data.length}`);

    // 4. Criar Escritório Teste
    console.log('\n[4] Criando Escritório de Teste...');
    const createRes = await api.post('/tenants', {
      name: 'Escritório de Teste API',
      plan: 'pro',
      supervisorName: 'Supervisor Teste',
      supervisorEmail: 'supervisor@teste.com'
    });
    console.log(`✅ Escritório criado: ${createRes.data.tenant.name}`);
    const tenantId = createRes.data.tenant.id;

    // 5. Listar Tenants Novamente
    const newTenantsRes = await api.get('/tenants');
    console.log(`✅ Agora existem ${newTenantsRes.data.length} escritórios.`);

    console.log('\n🎉 Todos os testes básicos passaram com sucesso!');
  } catch (error: any) {
    console.error('❌ Erro no teste:', error.response?.data || error.message);
  }
}

runTests();
