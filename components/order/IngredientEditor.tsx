'use client'

import { useMemo } from 'react'
import type { MenuCustomization, ModifierSelections } from '@/lib/menuCustomizations'

type Props = {
  customization: MenuCustomization | null | undefined
  selections: ModifierSelections
  onSelectionChange: (groupId: string, optionId: string, selected: boolean) => void
}

type GroupedModifiers = {
  remove: Array<{
    groupId: string
    groupName: string
    options: Array<{
      id: string
      label: string
      selected: boolean
    }>
  }>
  extra: Array<{
    groupId: string
    groupName: string
    options: Array<{
      id: string
      label: string
      selected: boolean
    }>
  }>
  substitute: Array<{
    groupId: string
    groupName: string
    type: 'single' | 'multi'
    options: Array<{
      id: string
      label: string
      selected: boolean
    }>
  }>
}

export function IngredientEditor({
  customization,
  selections,
  onSelectionChange,
}: Props) {
  const grouped = useMemo<GroupedModifiers>(() => {
    if (!customization?.groups) {
      return { remove: [], extra: [], substitute: [] }
    }

    const result: GroupedModifiers = {
      remove: [],
      extra: [],
      substitute: [],
    }

    for (const group of customization.groups) {
      const groupSelections = selections[group.id] ?? []
      const formattedOptions = group.options.map(opt => ({
        id: opt.id,
        label: opt.label,
        selected: groupSelections.includes(opt.id),
      }))

      if (group.id === 'remove_ingredients') {
        result.remove.push({
          groupId: group.id,
          groupName: group.name,
          options: formattedOptions,
        })
      } else if (group.id === 'extra_ingredients') {
        result.extra.push({
          groupId: group.id,
          groupName: group.name,
          options: formattedOptions,
        })
      } else {
        // Treat as substitute
        result.substitute.push({
          groupId: group.id,
          groupName: group.name,
          type: group.type,
          options: formattedOptions,
        })
      }
    }

    return result
  }, [customization, selections])

  return (
    <div className="ingredient-editor">
      {/* Remove Section */}
      {grouped.remove.length > 0 && (
        <div className="ingredient-editor-section">
          <div className="ingredient-editor-section-title">Remove</div>
          {grouped.remove.map(group => (
            <div key={group.groupId}>
              {group.options.map(option => (
                <label
                  key={option.id}
                  className="ingredient-editor-checkbox"
                >
                  <input
                    type="checkbox"
                    checked={option.selected}
                    onChange={e =>
                      onSelectionChange(
                        group.groupId,
                        option.id,
                        e.target.checked
                      )
                    }
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Extra Section */}
      {grouped.extra.length > 0 && (
        <div className="ingredient-editor-section">
          <div className="ingredient-editor-section-title">Extra</div>
          {grouped.extra.map(group => (
            <div key={group.groupId}>
              {group.options.map(option => (
                <label
                  key={option.id}
                  className="ingredient-editor-checkbox"
                >
                  <input
                    type="checkbox"
                    checked={option.selected}
                    onChange={e =>
                      onSelectionChange(
                        group.groupId,
                        option.id,
                        e.target.checked
                      )
                    }
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Substitute Section */}
      {grouped.substitute.length > 0 && (
        <div className="ingredient-editor-section">
          <div className="ingredient-editor-section-title">Substitute</div>
          {grouped.substitute.map(group => (
            <div key={group.groupId}>
              <div className="ingredient-editor-group-name">
                {group.groupName}
              </div>
              {group.options.map(option => (
                <label
                  key={option.id}
                  className="ingredient-editor-checkbox"
                >
                  <input
                    type={group.type === 'single' ? 'radio' : 'checkbox'}
                    name={
                      group.type === 'single' ? group.groupId : undefined
                    }
                    checked={option.selected}
                    onChange={e =>
                      onSelectionChange(
                        group.groupId,
                        option.id,
                        e.target.checked
                      )
                    }
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          ))}
        </div>
      )}

      {grouped.remove.length === 0 &&
        grouped.extra.length === 0 &&
        grouped.substitute.length === 0 && (
          <div className="ingredient-editor-empty">
            No ingredients available to customize.
          </div>
        )}
    </div>
  )
}
