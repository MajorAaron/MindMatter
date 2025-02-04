// Follow this example to create a Supabase Edge Function: https://supabase.com/docs/guides/functions
import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',  // More permissive for testing
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Max-Age': '86400',  // 24 hours cache for preflight
}

interface ArticleData {
  url: string
  title: string
  excerpt: string
  source: string
  image_url: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      headers: {
        ...corsHeaders,
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
      }
    })
  }

  try {
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // Get the request body
    const { url, title, excerpt, source, image_url } = await req.json() as ArticleData

    let storedImagePath = null

    // Download and store image if URL is provided
    if (image_url) {
      try {
        // Download image
        const imageResponse = await fetch(image_url)
        if (!imageResponse.ok) throw new Error('Failed to download image')
        const imageBlob = await imageResponse.blob()

        // Generate unique filename
        const extension = imageBlob.type.split('/')[1] || 'jpg'
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${extension}`

        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabaseClient.storage
          .from('article-images')
          .upload(fileName, imageBlob, {
            contentType: imageBlob.type,
            upsert: true
          })

        if (uploadError) throw uploadError
        storedImagePath = uploadData.path
      } catch (imageError) {
        console.error('Failed to process image:', imageError)
        // Continue with saving the article even if image processing fails
      }
    }

    // Save article data
    const articleData = {
      url,
      title,
      excerpt,
      source,
      time_added: new Date().toISOString(),
      image_url,
      stored_image_path: storedImagePath
    }

    const { data, error } = await supabaseClient
      .from('saved_articles')
      .insert(articleData)
      .select()
      .single()

    if (error) throw error

    return new Response(
      JSON.stringify({
        success: true,
        savedArticle: data
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
}) 