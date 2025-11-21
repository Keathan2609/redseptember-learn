import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Send } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Reply {
  id: string;
  content: string;
  created_at: string;
  author: {
    full_name: string;
    email: string;
  };
}

interface Post {
  id: string;
  title: string;
  content: string;
  created_at: string;
  author: {
    full_name: string;
    email: string;
  };
}

interface ForumPostCardProps {
  post: Post;
  replies: Reply[];
  onReplyAdded: () => void;
}

const ForumPostCard = ({ post, replies, onReplyAdded }: ForumPostCardProps) => {
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyContent, setReplyContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmitReply = async () => {
    if (!replyContent.trim()) return;

    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("forum_replies").insert({
      post_id: post.id,
      author_id: user.id,
      content: replyContent,
    });

    setSubmitting(false);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to post reply",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Success",
      description: "Reply posted successfully",
    });

    setReplyContent("");
    setShowReplyForm(false);
    onReplyAdded();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-4">
          <Avatar>
            <AvatarFallback>
              {post.author.full_name?.charAt(0) || post.author.email.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h3 className="font-semibold text-lg">{post.title}</h3>
            <p className="text-sm text-muted-foreground">
              {post.author.full_name || post.author.email} •{" "}
              {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-foreground whitespace-pre-wrap">{post.content}</p>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowReplyForm(!showReplyForm)}
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            Reply ({replies.length})
          </Button>
        </div>

        {showReplyForm && (
          <div className="space-y-2 pt-4 border-t">
            <Textarea
              placeholder="Write your reply..."
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              rows={3}
            />
            <div className="flex gap-2">
              <Button
                onClick={handleSubmitReply}
                disabled={submitting || !replyContent.trim()}
                size="sm"
              >
                <Send className="h-4 w-4 mr-2" />
                Post Reply
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowReplyForm(false);
                  setReplyContent("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {replies.length > 0 && (
          <div className="space-y-4 pt-4 border-t">
            {replies.map((reply) => (
              <div key={reply.id} className="flex gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs">
                    {reply.author.full_name?.charAt(0) || reply.author.email.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="bg-muted rounded-lg p-3">
                    <p className="font-medium text-sm">
                      {reply.author.full_name || reply.author.email}
                    </p>
                    <p className="text-sm mt-1 whitespace-pre-wrap">{reply.content}</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 ml-3">
                    {formatDistanceToNow(new Date(reply.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ForumPostCard;