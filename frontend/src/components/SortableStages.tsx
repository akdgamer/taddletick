import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

import type { DashboardStage } from '../api/types'
import { StageRow } from './StageRow'

interface Props {
  stages: DashboardStage[]
  canEdit: boolean
  canDelete: boolean
  /** Called with the dragged-into order of these stages */
  onReorder: (ids: number[]) => void
}

/** Unfinished stages, draggable by their handle into the order you work on them. */
export function SortableStages({ stages, canEdit, canDelete, onReorder }: Props) {
  const sensors = useSensors(
    // A small move before dragging starts, so clicks on the handle area still work
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    // Press and hold on touch screens, so scrolling the page still works
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const ids = stages.map((s) => s.id)
    onReorder(arrayMove(ids, ids.indexOf(Number(active.id)), ids.indexOf(Number(over.id))))
  }

  if (!canEdit || stages.length < 2) {
    return stages.map((s) => <StageRow key={s.id} stage={s} canEdit={canEdit} canDelete={canDelete} />)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      onDragEnd={onDragEnd}
      accessibility={{
        screenReaderInstructions: {
          draggable: 'To move a stage, press space, use the arrow keys, then press space again to drop it.',
        },
      }}
    >
      <SortableContext items={stages.map((s) => s.id)} strategy={verticalListSortingStrategy}>
        {stages.map((s) => (
          <SortableStage key={s.id} stage={s} canEdit={canEdit} canDelete={canDelete} />
        ))}
      </SortableContext>
    </DndContext>
  )
}

function SortableStage({ stage, canEdit, canDelete }: { stage: DashboardStage; canEdit: boolean; canDelete: boolean }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: stage.id,
  })
  return (
    <StageRow
      stage={stage}
      canEdit={canEdit}
      canDelete={canDelete}
      sortable={{
        ref: setNodeRef,
        style: { transform: CSS.Translate.toString(transform), transition },
        dragging: isDragging,
        handle: (
          <button
            ref={setActivatorNodeRef}
            className="drag-handle"
            aria-label={`Move ${stage.name}`}
            data-tip="Drag to reorder"
            {...attributes}
            {...listeners}
          >
            <GripIcon />
          </button>
        ),
      }}
    />
  )
}

function GripIcon() {
  return (
    <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor" aria-hidden>
      {[3, 8, 13].map((y) => [3, 7].map((x) => <circle key={`${x}${y}`} cx={x} cy={y} r="1.4" />))}
    </svg>
  )
}
