
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "blocks": {
                  Row: {
                    "blocked_id": string,"blocker_id": string,"created_at": string
                  }
                  Insert: {
                    "blocked_id": string,"blocker_id"?: string,"created_at"?: string
                  }
                  Update: {
                    "blocked_id"?: string,"blocker_id"?: string,"created_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "blocks_blocked_id_fkey"
      columns: ["blocked_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "blocks_blocker_id_fkey"
      columns: ["blocker_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"breeds": {
                  Row: {
                    "id": number,"name": string,"species_id": number
                  }
                  Insert: {
                    "id"?: never,"name": string,"species_id": number
                  }
                  Update: {
                    "id"?: never,"name"?: string,"species_id"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "breeds_species_id_fkey"
      columns: ["species_id"]
isOneToOne: false
      referencedRelation: "species"
      referencedColumns: ["id"]
    }
                  ]
                },"matches": {
                  Row: {
                    "created_at": string,"id": string,"pet_a_id": string,"pet_b_id": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"pet_a_id": string,"pet_b_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"pet_a_id"?: string,"pet_b_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "matches_pet_a_id_fkey"
      columns: ["pet_a_id"]
isOneToOne: false
      referencedRelation: "pets"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "matches_pet_b_id_fkey"
      columns: ["pet_b_id"]
isOneToOne: false
      referencedRelation: "pets"
      referencedColumns: ["id"]
    }
                  ]
                },"messages": {
                  Row: {
                    "body": string,"created_at": string,"id": string,"match_id": string,"read_at": string | null,"sender_id": string
                  }
                  Insert: {
                    "body": string,"created_at"?: string,"id"?: string,"match_id": string,"read_at"?: string | null,"sender_id"?: string
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"id"?: string,"match_id"?: string,"read_at"?: string | null,"sender_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "messages_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "matches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_sender_id_fkey"
      columns: ["sender_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"pet_photos": {
                  Row: {
                    "created_at": string,"id": string,"path": string,"pet_id": string,"position": number
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"path": string,"pet_id": string,"position"?: number
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"path"?: string,"pet_id"?: string,"position"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "pet_photos_pet_id_fkey"
      columns: ["pet_id"]
isOneToOne: false
      referencedRelation: "pets"
      referencedColumns: ["id"]
    }
                  ]
                },"pet_vaccinations": {
                  Row: {
                    "administered_on": string,"expires_on": string | null,"id": string,"pet_id": string,"vaccine_id": number
                  }
                  Insert: {
                    "administered_on": string,"expires_on"?: string | null,"id"?: string,"pet_id": string,"vaccine_id": number
                  }
                  Update: {
                    "administered_on"?: string,"expires_on"?: string | null,"id"?: string,"pet_id"?: string,"vaccine_id"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "pet_vaccinations_pet_id_fkey"
      columns: ["pet_id"]
isOneToOne: false
      referencedRelation: "pets"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pet_vaccinations_vaccine_id_fkey"
      columns: ["vaccine_id"]
isOneToOne: false
      referencedRelation: "vaccines"
      referencedColumns: ["id"]
    }
                  ]
                },"pets": {
                  Row: {
                    "birth_date": string,"breed_id": number | null,"breed_other": string | null,"city": string,"created_at": string,"description": string | null,"has_pedigree": boolean,"id": string,"is_active": boolean,"location": unknown,"name": string,"owner_id": string,"pedigree_number": string | null,"pedigree_registry": string | null,"postal_code": string,"sex": Database["public"]['Enums']["pet_sex"],"species_id": number,"updated_at": string
                  }
                  Insert: {
                    "birth_date": string,"breed_id"?: number | null,"breed_other"?: string | null,"city": string,"created_at"?: string,"description"?: string | null,"has_pedigree"?: boolean,"id"?: string,"is_active"?: boolean,"location": unknown,"name": string,"owner_id"?: string,"pedigree_number"?: string | null,"pedigree_registry"?: string | null,"postal_code": string,"sex": Database["public"]['Enums']["pet_sex"],"species_id": number,"updated_at"?: string
                  }
                  Update: {
                    "birth_date"?: string,"breed_id"?: number | null,"breed_other"?: string | null,"city"?: string,"created_at"?: string,"description"?: string | null,"has_pedigree"?: boolean,"id"?: string,"is_active"?: boolean,"location"?: unknown,"name"?: string,"owner_id"?: string,"pedigree_number"?: string | null,"pedigree_registry"?: string | null,"postal_code"?: string,"sex"?: Database["public"]['Enums']["pet_sex"],"species_id"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "pets_breed_species_fkey"
      columns: ["breed_id","species_id"]
isOneToOne: false
      referencedRelation: "breeds"
      referencedColumns: ["id","species_id"]
    },{
      foreignKeyName: "pets_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pets_species_id_fkey"
      columns: ["species_id"]
isOneToOne: false
      referencedRelation: "species"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"display_name": string,"id": string
                  }
                  Insert: {
                    "created_at"?: string,"display_name": string,"id": string
                  }
                  Update: {
                    "created_at"?: string,"display_name"?: string,"id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"reports": {
                  Row: {
                    "created_at": string,"details": string | null,"id": string,"match_id": string | null,"pet_id": string | null,"reason": Database["public"]['Enums']["report_reason"],"reported_owner_id": string | null,"reporter_id": string | null
                  }
                  Insert: {
                    "created_at"?: string,"details"?: string | null,"id"?: string,"match_id"?: string | null,"pet_id"?: string | null,"reason": Database["public"]['Enums']["report_reason"],"reported_owner_id"?: string | null,"reporter_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"details"?: string | null,"id"?: string,"match_id"?: string | null,"pet_id"?: string | null,"reason"?: Database["public"]['Enums']["report_reason"],"reported_owner_id"?: string | null,"reporter_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "reports_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "matches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reports_pet_id_fkey"
      columns: ["pet_id"]
isOneToOne: false
      referencedRelation: "pets"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reports_reported_owner_id_fkey"
      columns: ["reported_owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reports_reporter_id_fkey"
      columns: ["reporter_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"species": {
                  Row: {
                    "code": string,"id": number,"name": string
                  }
                  Insert: {
                    "code": string,"id": number,"name": string
                  }
                  Update: {
                    "code"?: string,"id"?: number,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"swipes": {
                  Row: {
                    "created_at": string,"id": string,"kind": Database["public"]['Enums']["swipe_kind"],"swiper_pet_id": string,"target_pet_id": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"kind": Database["public"]['Enums']["swipe_kind"],"swiper_pet_id": string,"target_pet_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["swipe_kind"],"swiper_pet_id"?: string,"target_pet_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "swipes_swiper_pet_id_fkey"
      columns: ["swiper_pet_id"]
isOneToOne: false
      referencedRelation: "pets"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "swipes_target_pet_id_fkey"
      columns: ["target_pet_id"]
isOneToOne: false
      referencedRelation: "pets"
      referencedColumns: ["id"]
    }
                  ]
                },"vaccines": {
                  Row: {
                    "code": string,"id": number,"name": string,"species_id": number
                  }
                  Insert: {
                    "code": string,"id"?: never,"name": string,"species_id": number
                  }
                  Update: {
                    "code"?: string,"id"?: never,"name"?: string,"species_id"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "vaccines_species_id_fkey"
      columns: ["species_id"]
isOneToOne: false
      referencedRelation: "species"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "are_compatible":
{ Args: { "p_pet_a": string,"p_pet_b": string }; Returns: boolean
                           },
"block_owner":
{ Args: { "p_owner_id": string }; Returns: undefined
                           },
"is_blocked_between":
{ Args: { "p_owner_a": string,"p_owner_b": string }; Returns: boolean
                           },
"is_match_participant":
{ Args: { "p_match_id": string }; Returns: boolean
                           },
"is_matched_with_my_pet":
{ Args: { "p_pet_id": string }; Returns: boolean
                           },
"is_pet_owner":
{ Args: { "p_pet_id": string }; Returns: boolean
                           },
"mark_messages_read":
{ Args: { "p_match_id": string }; Returns: undefined
                           },
"my_conversations":
{ Args: Record<PropertyKey, never>; Returns: {
              "last_message": string,"last_message_at": string,"last_message_mine": boolean,"match_id": string,"matched_at": string,"my_pet_id": string,"my_pet_name": string,"my_pet_photo": string,"other_city": string,"other_owner_id": string,"other_owner_name": string,"other_pet_id": string,"other_pet_name": string,"other_pet_photo": string,"other_species_id": number,"unread_count": number
            }[]
                           },
"received_likes":
{ Args: Record<PropertyKey, never>; Returns: {
              "birth_date": string,"breed_id": number,"breed_other": string,"city": string,"distance_km": number,"has_pedigree": boolean,"id": string,"liked_at": string,"my_pet_id": string,"my_pet_name": string,"name": string,"photo_paths": (string)[],"sex": Database["public"]['Enums']["pet_sex"],"species_id": number
            }[]
                           },
"reorder_pet_photos":
{ Args: { "p_pet_id": string,"p_photo_ids": (string)[] }; Returns: undefined
                           },
"search_pets":
{ Args: { "p_breed_ids"?: (number)[],"p_exclude_ids"?: (string)[],"p_limit"?: number,"p_max_age_years"?: number,"p_max_distance_km"?: number,"p_min_age_years"?: number,"p_seeker_pet_id": string }; Returns: {
              "birth_date": string,"breed_id": number,"breed_other": string,"city": string,"distance_km": number,"has_pedigree": boolean,"id": string,"name": string,"photo_paths": (string)[],"sex": Database["public"]['Enums']["pet_sex"],"species_id": number
            }[]
                           },
"set_pet_vaccinations":
{ Args: { "p_items": Json,"p_pet_id": string }; Returns: undefined
                           },
"swipe_pet":
{ Args: { "p_kind": Database["public"]['Enums']["swipe_kind"],"p_swiper_pet_id": string,"p_target_pet_id": string }; Returns: string
                           },
"unmatch":
{ Args: { "p_match_id": string }; Returns: undefined
                           }
          }
          Enums: {
            "pet_sex": "male"|"female","report_reason": "fake_profile"|"inappropriate_content"|"harassment"|"scam"|"animal_welfare"|"other","swipe_kind": "like"|"pass"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "pet_sex": ["male", "female"],"report_reason": ["fake_profile", "inappropriate_content", "harassment", "scam", "animal_welfare", "other"],"swipe_kind": ["like", "pass"]
          }
        }
} as const
