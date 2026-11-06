<script setup lang="ts">
export interface StatRow {
  label: string
  value: string
}
defineProps<{ title: string; rows: StatRow[]; hint: string }>()
</script>

<template>
  <section class="stat-card" :aria-label="title">
    <h3>{{ title }}</h3>
    <dl>
      <div v-for="row in rows" :key="row.label">
        <dt>{{ row.label }}</dt>
        <dd>{{ row.value }}</dd>
      </div>
    </dl>
    <p>{{ hint }}</p>
  </section>
</template>

<style scoped>
.stat-card {
  min-width: 0;
  padding: 24px;
}
h3 {
  font-size: 20px;
  font-weight: 600;
  line-height: 28px;
}
dl {
  display: grid;
  gap: 16px;
  margin-top: 16px;
}
dl > div {
  display: flex;
  justify-content: space-between;
  gap: 16px;
}
dt {
  min-width: 0;
  color: var(--color-secondary);
  font-size: 15px;
  line-height: 22px;
}
dd {
  flex-shrink: 0;
  font-size: 16px;
  font-weight: 600;
  line-height: 22px;
  font-variant-numeric: tabular-nums;
}
p {
  margin-top: 16px;
  color: var(--color-secondary);
  font-size: 12px;
  line-height: 18px;
}
</style>
