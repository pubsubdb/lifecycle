<script setup lang="ts">
import HelloWorld from './components/HelloWorld.vue'
</script>

<template>
  <div>
    <a href="https://github.com/pubsubdb/pubsubdb" target="_blank">
      <img src="./assets/psdb.png" class="logo" alt="Redis in the Middle" />
    </a>
  </div>
  <HelloWorld msg="PubSubDB" />
</template>

<style scoped>
.logo {
  position: absolute;
  width: 500px;
  height:500px;
  left:10px;
  top:10px;
  will-change: filter;
  transition: filter 300ms;
}
.logo:hover {
  filter: drop-shadow(0 0 2em #76baccaa);
}
</style>
