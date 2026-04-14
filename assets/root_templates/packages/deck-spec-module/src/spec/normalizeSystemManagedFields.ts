import type {
    DeckImageAsset,
    DeckImageAssetCandidate,
    DeckSpec,
    DeckSpecCandidate,
    DeckSpecStatus,
    ImageAssetStatus,
    SharedVisualAsset,
    SharedVisualAssetCandidate,
    SlideStatus,
    TextAsset,
    TextAssetCandidate,
    TextAssetStatus,
} from './contract.js'
import {
    DEFAULT_DECK_SPEC_VERSION,
    deckSpecStatusValues,
    imageAssetStatusValues,
    slideStatusValues,
    textAssetStatusValues,
} from './contract.js'
import { deriveOutputFileName } from './deriveOutputFileName.js'

type NormalizeOptions = {
    projectSlug: string
    sourcePrompt: string
    generatedAt?: string
    specVersion?: string
    specStatus?: DeckSpecStatus
    slideStatus?: SlideStatus
    textAssetStatus?: TextAssetStatus
    imageAssetStatus?: ImageAssetStatus
}

function defaultGeneratedAt(): string {
    return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
}

function normalizeAssetId(value: unknown): string {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : 'unnamed_asset'
}

function toTitleCase(token: string): string {
    return token.length === 0 ? token : `${token.slice(0, 1).toUpperCase()}${token.slice(1)}`
}

function deriveFallbackAssetLabel(assetId: string): string {
    const humanizedId = assetId.trim().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ')

    return humanizedId.length > 0
        ? humanizedId.split(' ').map(toTitleCase).join(' ')
        : 'Untitled Asset'
}

function normalizeAssetLabel(value: unknown, fallbackAssetId: string): string {
    return typeof value === 'string' && value.trim().length > 0
        ? value.trim()
        : deriveFallbackAssetLabel(fallbackAssetId)
}

function normalizeTextAsset(asset: TextAssetCandidate, status: TextAssetStatus): TextAsset {
    const assetId = normalizeAssetId(asset.asset_id)
    const assetLabel = normalizeAssetLabel(asset.asset_label, assetId)

    return asset.text_kind === 'bullet_list'
        ? ({
              asset_id: assetId,
              asset_label: assetLabel,
              text_kind: 'bullet_list',
              content: asset.content,
              required: asset.required,
              status: status,
          } as TextAsset)
        : ({
              asset_id: assetId,
              asset_label: assetLabel,
              text_kind: 'plain_text',
              content: asset.content,
              required: asset.required,
              status: status,
          } as TextAsset)
}

function normalizeImageAsset(asset: DeckImageAssetCandidate): DeckImageAsset {
    const assetId = normalizeAssetId(asset.asset_id)
    const assetLabel = normalizeAssetLabel(asset.asset_label, assetId)
    const normalizedAsset = {
        asset_id: assetId,
        asset_label: assetLabel,
        slide_id: asset.slide_id,
        intended_usage: asset.intended_usage,
        size_tier: asset.size_tier,
        style: asset.style,
        subject: asset.subject,
        aspect_ratio: asset.aspect_ratio,
        image_prompt_spec: asset.image_prompt_spec,
        output_format: asset.output_format,
        required: asset.required,
    } as DeckImageAsset

    return {
        ...normalizedAsset,
        output_file_name: deriveOutputFileName(normalizedAsset),
    }
}

function normalizeImageAssetWithStatus(
    asset: DeckImageAssetCandidate,
    status: ImageAssetStatus,
): DeckImageAsset {
    return {
        ...normalizeImageAsset(asset),
        status: status,
    }
}

function normalizeSharedAsset(asset: SharedVisualAssetCandidate): SharedVisualAsset {
    const assetId = normalizeAssetId(asset.asset_id)
    const assetLabel = normalizeAssetLabel(asset.asset_label, assetId)
    const normalizedAsset = {
        asset_id: assetId,
        asset_label: assetLabel,
        shared_scope: asset.shared_scope,
        intended_usage: asset.intended_usage,
        size_tier: asset.size_tier,
        style: asset.style,
        subject: asset.subject,
        aspect_ratio: asset.aspect_ratio,
        image_prompt_spec: asset.image_prompt_spec,
        output_format: asset.output_format,
        required: asset.required,
    } as SharedVisualAsset

    return {
        ...normalizedAsset,
        output_file_name: deriveOutputFileName(normalizedAsset),
    }
}

function normalizeSharedAssetWithStatus(
    asset: SharedVisualAssetCandidate,
    status: ImageAssetStatus,
): SharedVisualAsset {
    return {
        ...normalizeSharedAsset(asset),
        status: status,
    }
}

export function normalizeSystemManagedFields(
    deckSpecCandidate: DeckSpecCandidate,
    options: NormalizeOptions,
): DeckSpec {
    const generatedAt =
        options.generatedAt ?? deckSpecCandidate.generated_at ?? defaultGeneratedAt()
    const specStatus = options.specStatus ?? deckSpecStatusValues[0]
    const slideStatus = options.slideStatus ?? slideStatusValues[0]
    const textAssetStatus = options.textAssetStatus ?? textAssetStatusValues[0]
    const imageAssetStatus = options.imageAssetStatus ?? imageAssetStatusValues[0]

    return {
        ...deckSpecCandidate,
        spec_version:
            options.specVersion ?? deckSpecCandidate.spec_version ?? DEFAULT_DECK_SPEC_VERSION,
        generated_at: generatedAt,
        project_slug: options.projectSlug,
        source_prompt: options.sourcePrompt,
        status: specStatus,
        slides: deckSpecCandidate.slides.map((slide) => ({
            ...slide,
            status: slideStatus,
        })),
        asset_manifest: {
            ...deckSpecCandidate.asset_manifest,
            text_assets: deckSpecCandidate.asset_manifest.text_assets.map((asset) =>
                normalizeTextAsset(asset, textAssetStatus),
            ),
            image_assets: deckSpecCandidate.asset_manifest.image_assets.map((asset) =>
                normalizeImageAssetWithStatus(asset, imageAssetStatus),
            ),
            shared_assets: deckSpecCandidate.asset_manifest.shared_assets.map((asset) =>
                normalizeSharedAssetWithStatus(asset, imageAssetStatus),
            ),
        },
    }
}
