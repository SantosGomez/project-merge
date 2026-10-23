<template>
  <!--
    Layout propio de P-1 (RF-01): sin menú interno ni controles de simulación.
    Centra el contenido de la pantalla de inicio de sesión y deja el título
    visible a cargo de LoginPage.vue (RNF-04).
  -->
  <q-layout view="hHh Lpr fFf" class="login-layout">
    <q-page-container>
      <q-page class="login-layout__page">
        <router-view />
      </q-page>
    </q-page-container>
  </q-layout>
</template>

<style scoped>
.login-layout {
  background: linear-gradient(135deg, #eef4fb 0%, #f7f9fc 45%, #e8f0f7 100%);
}

.login-layout__page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 24px 16px;
}

@media (min-width: 600px) {
  .login-layout__page {
    padding: 32px 24px;
  }
}
</style>
