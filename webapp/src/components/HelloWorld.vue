<script setup lang="ts">
import { ref } from 'vue'
defineProps<{ msg: string }>()
const count = ref(0)
</script>

<template>
  <div class="bottom-left">
    <button type="button" @click="count++">count is {{ count }}</button>
  </div>
  <small class="up-right">{{ msg }}</small>
</template>

<style scoped>
  .up-right {
    position: absolute;
    top: 10px;
    right: 10px;
  }

  .bottom-left {
    position: absolute;
    bottom: 10px;
    left: 10px;
  }
</style>
