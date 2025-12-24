import { createRouter, createWebHashHistory } from 'vue-router';

const router = createRouter({
	history: createWebHashHistory(),
	routes: [
		{
			path: '/',
			redirect: '/list',
		},
		{
			path: '/list',
			name: 'list',
			component: () => import('../views/ListView.vue'),
			meta: { title: '发布列表' },
		},
		{
			path: '/editor',
			name: 'editor',
			component: () => import('../views/EditorView.vue'),
			meta: { title: '发布文章' },
		},
		{
			path: '/editor/:id',
			name: 'edit',
			component: () => import('../views/EditorView.vue'),
			meta: { title: '编辑文章' },
		},
		{
			path: '/preview/:id',
			name: 'preview',
			component: () => import('../views/PreviewView.vue'),
			meta: { title: '文章预览' },
		},
		{
			path: '/settings',
			name: 'settings',
			component: () => import('../views/SettingsView.vue'),
			meta: { title: '设置' },
		},
		{
			path: '/topics',
			name: 'topics',
			component: () => import('../views/TopicsView.vue'),
			meta: { title: '话题管理' },
		},
		{
			path: '/help',
			name: 'help',
			component: () => import('../views/HelpView.vue'),
			meta: { title: '帮助' },
		},
	],
});

export default router;
