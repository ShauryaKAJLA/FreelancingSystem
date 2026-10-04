import { baseApi } from '../../app/store/baseApi'
import { request } from './http'

// ── Live (Admin-only writes; the body key is `skillName`) ──────────────────────────────────
const liveGetSkills = () => request('get', '/skills')
const liveGetSkillsWithUsage = () => request('get', '/skills', { params: { usage: true } }) // Admin only
const liveGetSkill = (skillId) => request('get', `/skills/${skillId}`)
const liveCreateSkill = ({ skillName }) => request('post', '/skills', { data: { skillName } })
const liveUpdateSkill = ({ skillId, skillName }) => request('put', `/skills/${skillId}`, { data: { skillName } })
const liveDeleteSkill = (skillId) => request('delete', `/skills/${skillId}`)

export const skillsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getSkills: builder.query({ queryFn: liveGetSkills, providesTags: ['Skills'] }),
    getSkillsWithUsage: builder.query({ queryFn: liveGetSkillsWithUsage, providesTags: ['Skills'] }),
    getSkill: builder.query({ queryFn: liveGetSkill, providesTags: ['Skills'] }),
    createSkill: builder.mutation({ queryFn: liveCreateSkill, invalidatesTags: ['Skills', 'AdminActions'] }),
    updateSkill: builder.mutation({ queryFn: liveUpdateSkill, invalidatesTags: ['Skills', 'AdminActions'] }),
    deleteSkill: builder.mutation({ queryFn: liveDeleteSkill, invalidatesTags: ['Skills', 'AdminActions'] }),
  }),
})

export const { useGetSkillsQuery, useGetSkillsWithUsageQuery, useGetSkillQuery, useCreateSkillMutation, useUpdateSkillMutation, useDeleteSkillMutation } = skillsApi

const NONE = []
export function useSkills() {
  const { data } = useGetSkillsQuery()
  return data ?? NONE
}
